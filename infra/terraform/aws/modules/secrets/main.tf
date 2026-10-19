# Counterpart of the Azure Key Vault module. Secrets Manager has no vault resource: each secret is
# its own resource under a name prefix. This module holds what is shared by them: a customer
# managed KMS key and a read policy for that prefix, which External Secrets Operator gets through
# Pod Identity later. Secrets themselves are re-seeded on every rebuild, never kept here.

terraform {
  required_version = ">= 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.60"
    }
  }
}

variable "name" {
  description = "Name stem, e.g. resonance-dev."
  type        = string
}

variable "secret_prefix" {
  description = "Secrets Manager name prefix the read policy covers, e.g. resonance/dev."
  type        = string
}

variable "tags" {
  description = "Extra tags on top of the provider default tags."
  type        = map(string)
  default     = {}
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

data "aws_region" "current" {}

# The shortest deletion window, so a destroyed environment stops costing money within a week.
resource "aws_kms_key" "this" {
  description             = "Secrets Manager key for ${var.name}"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  tags                    = var.tags
}

resource "aws_kms_alias" "this" {
  name          = "alias/${var.name}-secrets"
  target_key_id = aws_kms_key.this.key_id
}

data "aws_iam_policy_document" "read" {
  statement {
    sid = "ReadSecrets"
    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetSecretValue",
      "secretsmanager:ListSecretVersionIds",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:secretsmanager:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:secret:${var.secret_prefix}/*",
    ]
  }

  statement {
    sid       = "DecryptSecrets"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.this.arn]
  }
}

resource "aws_iam_policy" "read" {
  name        = "${var.name}-secrets-read"
  description = "Read ${var.secret_prefix}/* secrets."
  policy      = data.aws_iam_policy_document.read.json
  tags        = var.tags
}

output "kms_key_arn" {
  value = aws_kms_key.this.arn
}

output "kms_alias" {
  value = aws_kms_alias.this.name
}

output "read_policy_arn" {
  value = aws_iam_policy.read.arn
}

output "secret_prefix" {
  value = var.secret_prefix
}
