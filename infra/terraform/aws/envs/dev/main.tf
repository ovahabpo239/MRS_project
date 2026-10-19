# Ephemeral layer: everything that costs money. Built and destroyed every iteration
# (make cloud-up / cloud-down); infra/scripts/aws/nuke.sh is the safety net if a destroy is skipped.

provider "aws" {
  region = var.region

  # nuke.sh selects on project + lifecycle; component (set per module) feeds the cost view.
  default_tags {
    tags = local.tags
  }
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

# Turns an assumed-role session ARN (CI) into the role ARN that an EKS access entry needs.
data "aws_iam_session_context" "current" {
  arn = data.aws_caller_identity.current.arn
}

locals {
  env  = "dev"
  name = "${var.project}-${local.env}"

  admin_principal_arns = distinct(concat([data.aws_iam_session_context.current.issuer_arn], var.admin_principal_arns))

  # Must match the boundary the bootstrap's CI role requires on every role it creates.
  permissions_boundary_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/PowerUserAccess"

  tags = {
    project    = var.project
    env        = local.env
    lifecycle  = "ephemeral"
    managed_by = "terraform"
  }
}

module "network" {
  source = "../../modules/network"

  name         = local.name
  cluster_name = "eks-${local.name}"
  tags         = { component = "network" }
}

module "eks" {
  source = "../../modules/eks"

  name                     = local.name
  subnet_ids               = module.network.subnet_ids
  kubernetes_version       = var.kubernetes_version
  system_instance_type     = var.system_instance_type
  app_instance_type        = var.app_instance_type
  app_max_count            = var.app_max_count
  admin_principal_arns     = local.admin_principal_arns
  permissions_boundary_arn = local.permissions_boundary_arn
  tags                     = { component = "eks" }
}

module "secrets" {
  source = "../../modules/secrets"

  name          = local.name
  secret_prefix = "${var.project}/${local.env}"
  tags          = { component = "secrets" }
}
