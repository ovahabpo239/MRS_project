variable "project" {
  description = "Short project name used in every resource name and the `project` tag."
  type        = string
  default     = "resonance"
}

variable "region" {
  description = "AWS region for the state bucket. Environments default to the same region."
  type        = string
  default     = "eu-north-1"
}

variable "github_repository" {
  description = "owner/name of the repository whose workflows may assume the CI role."
  type        = string
  default     = "ovahabpo239/MRS_project"
}

variable "github_environment" {
  description = "GitHub environment that gates apply and destroy runs."
  type        = string
  default     = "aws"
}

variable "monthly_budget" {
  description = "Monthly account budget in USD, before credits. Alerts fire at 50, 80 and 100 percent."
  type        = number
  default     = 30
}

variable "budget_contact_emails" {
  description = "Who receives budget alerts. Set it in terraform.tfvars (gitignored), never in a committed file."
  type        = list(string)

  validation {
    condition     = length(var.budget_contact_emails) > 0
    error_message = "At least one contact email is required."
  }
}
