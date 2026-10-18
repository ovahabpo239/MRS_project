variable "project" {
  description = "Short project name used in every resource name and the `project` tag."
  type        = string
  default     = "resonance"
}

variable "location" {
  description = "Azure region."
  type        = string
  default     = "eastus"
}

variable "admin_object_ids" {
  description = <<-EOT
    Extra Entra object IDs that get cluster and vault admin. Whoever runs Terraform is always
    included. Put your own ID here (az ad signed-in-user show --query id -o tsv) so you keep
    access to environments that CI creates.
  EOT
  type        = list(string)
  default     = []
}

variable "kubernetes_version" {
  description = "Pinned Kubernetes version, or null for the region default."
  type        = string
  default     = null
}

variable "system_vm_size" {
  description = "VM size of the system pool."
  type        = string
  default     = "Standard_B2s"
}

variable "app_vm_size" {
  description = "VM size of the autoscaled app pool."
  type        = string
  default     = "Standard_B2ms"
}

variable "app_max_count" {
  description = "Upper bound for the app pool autoscaler."
  type        = number
  default     = 2
}
