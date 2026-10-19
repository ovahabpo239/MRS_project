variable "project" {
  description = "Short project name used in every resource name and the `project` tag."
  type        = string
  default     = "resonance"
}

variable "location" {
  description = "Azure region for the permanent resources."
  type        = string
  default     = "eastus"
}

variable "github_repository" {
  description = "owner/name of the repository whose workflows may log in to Azure."
  type        = string
  default     = "ovahabpo239/MRS_project"
}

variable "github_environment" {
  description = "GitHub environment that gates apply and destroy runs."
  type        = string
  default     = "azure"
}

variable "monthly_budget" {
  description = "Monthly subscription budget in the billing currency. Alerts fire at 50, 80 and 100 percent."
  type        = number
  default     = 150
}

variable "budget_contact_emails" {
  description = "Who receives budget alerts. Set it in terraform.tfvars (gitignored), never in a committed file."
  type        = list(string)

  validation {
    condition     = length(var.budget_contact_emails) > 0
    error_message = "At least one contact email is required."
  }
}
