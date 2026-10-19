variable "project" {
  description = "Short project name used in every resource name and the `project` tag."
  type        = string
  default     = "resonance"
}

variable "region" {
  description = "AWS region."
  type        = string
  default     = "eu-north-1"
}

variable "admin_principal_arns" {
  description = <<-EOT
    Extra IAM user or role ARNs that get cluster admin. Whoever runs Terraform is always included.
    Put your own ARN here (aws sts get-caller-identity --query Arn --output text) so you keep
    access to environments that CI creates.
  EOT
  type        = list(string)
  default     = []
}

variable "kubernetes_version" {
  description = "Pinned Kubernetes version, or null for the current EKS default."
  type        = string
  default     = null
}

# t3.medium (2 vCPU, 4 GiB) is the smallest size that fits the system add-ons with room for pods:
# VPC CNI limits it to 17 pods, a t3.small to 11.
variable "system_instance_type" {
  description = "Instance type of the system node group."
  type        = string
  default     = "t3.medium"
}

variable "app_instance_type" {
  description = "Instance type of the app node group."
  type        = string
  default     = "t3.medium"
}

# One system node cannot hold kube-system, Argo CD, the observability stack and the apps (pod
# limit and memory), so dev starts with one app node. 0 saves about USD 0.04/h when only the
# cluster itself is needed.
variable "app_min_count" {
  description = "Lower bound (and starting size) of the app node group."
  type        = number
  default     = 1
}

variable "app_max_count" {
  description = "Upper bound for the app node group."
  type        = number
  default     = 2
}
