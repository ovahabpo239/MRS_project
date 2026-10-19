# Permanent layer: everything that must survive an ephemeral teardown. It costs cents per month
# and is applied by hand (make cloud-bootstrap), never by CI.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project    = var.project
      lifecycle  = "permanent"
      managed_by = "terraform"
      component  = "bootstrap"
    }
  }
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  partition  = data.aws_partition.current.partition

  # Every IAM role CI creates must carry this boundary, so no environment role can ever do more
  # than a power user (no IAM, no Organizations). envs/*/main.tf uses the same ARN.
  permissions_boundary_arn = "arn:${local.partition}:iam::aws:policy/PowerUserAccess"

  github_subjects = [
    "repo:${var.github_repository}:ref:refs/heads/main",
    "repo:${var.github_repository}:pull_request",
    "repo:${var.github_repository}:environment:${var.github_environment}",
  ]
}

# --- Terraform state -------------------------------------------------------------------------

# Bucket names are global; the account ID keeps the name stable per account and unique.
resource "aws_s3_bucket" "tfstate" {
  bucket = "${var.project}-tfstate-${local.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_ownership_controls" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Same 7-day safety window as the soft delete on the Azure state account.
resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  depends_on = [aws_s3_bucket_versioning.tfstate]
}

data "aws_iam_policy_document" "tfstate" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.tfstate.arn, "${aws_s3_bucket.tfstate.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  policy = data.aws_iam_policy_document.tfstate.json

  depends_on = [aws_s3_bucket_public_access_block.tfstate]
}

# --- CI identity (GitHub Actions OIDC, no stored secrets) -------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.github_subjects
    }
  }
}

resource "aws_iam_role" "github" {
  name                 = "${var.project}-github"
  description          = "Assumed by GitHub Actions through OIDC to plan, apply and nuke ephemeral environments."
  assume_role_policy   = data.aws_iam_policy_document.github_trust.json
  max_session_duration = 3600
}

# Everything except IAM, Organizations and account settings.
resource "aws_iam_role_policy_attachment" "github_power_user" {
  role       = aws_iam_role.github.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/PowerUserAccess"
}

# The IAM that environments need, and no more: roles and policies named <project>-*, and only
# with the permissions boundary attached. This is the AWS counterpart of the conditional
# "RBAC Administrator" grant on Azure. The CI role has no boundary itself, so the boundary
# condition already stops it from editing its own permissions; the explicit deny covers the
# actions that cannot carry that condition.
data "aws_iam_policy_document" "github_iam" {
  statement {
    sid       = "ReadIam"
    actions   = ["iam:Get*", "iam:List*"]
    resources = ["*"]
  }

  statement {
    sid = "RolesOnlyWithBoundary"
    actions = [
      "iam:AttachRolePolicy",
      "iam:CreateRole",
      "iam:DeleteRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePermissionsBoundary",
      "iam:PutRolePolicy",
    ]
    resources = ["arn:${local.partition}:iam::${local.account_id}:role/${var.project}-*"]

    condition {
      test     = "StringEquals"
      variable = "iam:PermissionsBoundary"
      values   = [local.permissions_boundary_arn]
    }
  }

  statement {
    sid = "RoleLifecycle"
    actions = [
      "iam:DeleteRole",
      "iam:PassRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:UpdateRole",
      "iam:UpdateRoleDescription",
    ]
    resources = ["arn:${local.partition}:iam::${local.account_id}:role/${var.project}-*"]
  }

  statement {
    sid = "Policies"
    actions = [
      "iam:CreatePolicy",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicy",
      "iam:DeletePolicyVersion",
      "iam:SetDefaultPolicyVersion",
      "iam:TagPolicy",
      "iam:UntagPolicy",
    ]
    resources = ["arn:${local.partition}:iam::${local.account_id}:policy/${var.project}-*"]
  }

  statement {
    sid         = "ProtectSelf"
    effect      = "Deny"
    not_actions = ["iam:Get*", "iam:List*"]
    resources   = [aws_iam_role.github.arn]
  }

  statement {
    sid       = "KeepBoundaries"
    effect    = "Deny"
    actions   = ["iam:DeleteRolePermissionsBoundary"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_iam" {
  name   = "scoped-iam"
  role   = aws_iam_role.github.id
  policy = data.aws_iam_policy_document.github_iam.json
}

# CI reads and writes state like any other principal; the bucket has no extra grants because
# PowerUserAccess already covers S3.

# --- Cost guardrail ---------------------------------------------------------------------------

# Account-wide on purpose: the credit is shared by everything in the account. include_credit =
# false makes the budget track usage before credits, so the alerts show how fast the credit burns.
resource "aws_budgets_budget" "monthly" {
  name         = "${var.project}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_types {
    include_credit = false
    include_refund = false
  }

  dynamic "notification" {
    for_each = {
      actual-50    = { threshold = 50, type = "ACTUAL" }
      actual-80    = { threshold = 80, type = "ACTUAL" }
      actual-100   = { threshold = 100, type = "ACTUAL" }
      forecast-100 = { threshold = 100, type = "FORECASTED" }
    }

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value.type
      subscriber_email_addresses = var.budget_contact_emails
    }
  }
}
