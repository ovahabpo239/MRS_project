# Small, disposable EKS cluster: one system node, an app node group that can idle at zero, IAM
# access entries only (no aws-auth ConfigMap), and Pod Identity for workloads (spec 7.6).
#
# Two differences from AKS worth knowing: the control plane is never free (USD 0.10/h), and a
# managed node group does not autoscale on its own. Scaling the app group from zero needs Cluster
# Autoscaler or Karpenter in the cluster, which belongs to platform/.

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
  description = "Name stem, e.g. resonance-dev. IAM names start with it, which the CI role requires."
  type        = string
}

variable "subnet_ids" {
  description = "Subnets for the control plane ENIs and the nodes."
  type        = list(string)
}

variable "kubernetes_version" {
  description = "Pinned Kubernetes version, or null for the current EKS default."
  type        = string
  default     = null
}

variable "system_instance_type" {
  description = "Instance type of the system node group."
  type        = string
  default     = "t3.medium"
}

variable "system_node_count" {
  description = "Nodes in the system node group."
  type        = number
  default     = 1
}

variable "app_instance_type" {
  description = "Instance type of the app node group."
  type        = string
  default     = "t3.medium"
}

variable "app_min_count" {
  description = "Minimum app nodes. 0 lets the group idle at no cost."
  type        = number
  default     = 0
}

variable "app_max_count" {
  description = "Maximum app nodes."
  type        = number
  default     = 2
}

variable "disk_size_gb" {
  description = "Node root volume size."
  type        = number
  default     = 20
}

variable "admin_principal_arns" {
  description = "IAM user or role ARNs granted AmazonEKSClusterAdminPolicy."
  type        = list(string)
}

variable "permissions_boundary_arn" {
  description = "Boundary on every IAM role created here. The CI role refuses to create roles without it."
  type        = string
}

variable "tags" {
  description = "Extra tags on top of the provider default tags."
  type        = map(string)
  default     = {}
}

data "aws_partition" "current" {}

locals {
  aws_policy = "arn:${data.aws_partition.current.partition}:iam::aws:policy"
}

# --- Control plane ----------------------------------------------------------------------------

data "aws_iam_policy_document" "cluster_trust" {
  statement {
    actions = ["sts:AssumeRole", "sts:TagSession"]

    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cluster" {
  name                 = "${var.name}-eks-cluster"
  assume_role_policy   = data.aws_iam_policy_document.cluster_trust.json
  permissions_boundary = var.permissions_boundary_arn
  tags                 = var.tags
}

resource "aws_iam_role_policy_attachment" "cluster" {
  role       = aws_iam_role.cluster.name
  policy_arn = "${local.aws_policy}/AmazonEKSClusterPolicy"
}

resource "aws_eks_cluster" "this" {
  name     = "eks-${var.name}"
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version

  # Add-ons are managed below as EKS add-ons, so nothing is installed outside Terraform's view.
  bootstrap_self_managed_addons = false

  access_config {
    authentication_mode                         = "API"
    bootstrap_cluster_creator_admin_permissions = false
  }

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_public_access  = true
    endpoint_private_access = true
  }

  kubernetes_network_config {
    service_ipv4_cidr = "10.100.0.0/16"
  }

  # Extended support costs USD 0.60/h instead of 0.10/h. With STANDARD the cluster is upgraded
  # automatically when standard support ends instead.
  upgrade_policy {
    support_type = "STANDARD"
  }

  tags = var.tags

  depends_on = [aws_iam_role_policy_attachment.cluster]
}

# Whoever applies plus admin_principal_arns, the same model as the AKS RBAC Cluster Admin grant.
resource "aws_eks_access_entry" "admin" {
  for_each = toset(var.admin_principal_arns)

  cluster_name  = aws_eks_cluster.this.name
  principal_arn = each.value
  type          = "STANDARD"
  tags          = var.tags
}

resource "aws_eks_access_policy_association" "admin" {
  for_each = aws_eks_access_entry.admin

  cluster_name  = aws_eks_cluster.this.name
  principal_arn = each.value.principal_arn
  policy_arn    = "arn:${data.aws_partition.current.partition}:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }
}

# DaemonSet add-ons go active without nodes; nodes need the CNI before they report Ready.
resource "aws_eks_addon" "before_nodes" {
  for_each = toset(["vpc-cni", "kube-proxy", "eks-pod-identity-agent"])

  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = each.key
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  tags                        = var.tags
}

# --- Nodes ------------------------------------------------------------------------------------

data "aws_iam_policy_document" "node_trust" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "node" {
  name                 = "${var.name}-eks-node"
  assume_role_policy   = data.aws_iam_policy_document.node_trust.json
  permissions_boundary = var.permissions_boundary_arn
  tags                 = var.tags
}

resource "aws_iam_role_policy_attachment" "node" {
  for_each = toset([
    "AmazonEKSWorkerNodePolicy",
    "AmazonEKS_CNI_Policy",
    "AmazonEC2ContainerRegistryReadOnly",
  ])

  role       = aws_iam_role.node.name
  policy_arn = "${local.aws_policy}/${each.key}"
}

resource "aws_eks_node_group" "system" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "system"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.subnet_ids
  ami_type        = "AL2023_x86_64_STANDARD"
  capacity_type   = "ON_DEMAND"
  instance_types  = [var.system_instance_type]
  disk_size       = var.disk_size_gb
  labels          = { pool = "system" }

  scaling_config {
    desired_size = var.system_node_count
    min_size     = var.system_node_count
    max_size     = var.system_node_count + 1
  }

  update_config {
    max_unavailable = 1
  }

  tags = var.tags

  depends_on = [aws_iam_role_policy_attachment.node, aws_eks_addon.before_nodes]
}

resource "aws_eks_node_group" "app" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "app"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.subnet_ids
  ami_type        = "AL2023_x86_64_STANDARD"
  capacity_type   = "ON_DEMAND"
  instance_types  = [var.app_instance_type]
  disk_size       = var.disk_size_gb
  labels          = { pool = "app" }

  scaling_config {
    desired_size = var.app_min_count
    min_size     = var.app_min_count
    max_size     = var.app_max_count
  }

  update_config {
    max_unavailable = 1
  }

  tags = var.tags

  lifecycle {
    # Owned by the autoscaler (or by hand) once the cluster runs.
    ignore_changes = [scaling_config[0].desired_size]
  }

  depends_on = [aws_iam_role_policy_attachment.node, aws_eks_addon.before_nodes]
}

# CoreDNS is a Deployment: created before any node it would sit degraded until Terraform times out.
resource "aws_eks_addon" "coredns" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "coredns"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  tags                        = var.tags

  depends_on = [aws_eks_node_group.system]
}

output "name" {
  value = aws_eks_cluster.this.name
}

output "arn" {
  value = aws_eks_cluster.this.arn
}

output "endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "oidc_issuer_url" {
  value = aws_eks_cluster.this.identity[0].oidc[0].issuer
}

output "node_role_arn" {
  value = aws_iam_role.node.arn
}
