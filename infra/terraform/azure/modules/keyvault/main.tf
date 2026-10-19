# RBAC-mode Key Vault that can be destroyed and recreated under the same name right away:
# no purge protection, and the root provider purges it on destroy.

terraform {
  required_version = ">= 1.15"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 5.10"
    }
  }
}

variable "name" {
  description = "Globally unique vault name, 3-24 characters."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group that holds the vault."
  type        = string
}

variable "location" {
  description = "Azure region."
  type        = string
}

variable "tenant_id" {
  description = "Entra tenant of the vault."
  type        = string
}

variable "admin_object_ids" {
  description = "Entra object IDs granted Key Vault Administrator."
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
}

# Destroying it is the point: secrets are re-seeded on every rebuild, never kept here.
# tflint-ignore: azurerm_resources_missing_prevent_destroy
resource "azurerm_key_vault" "this" {
  name                       = var.name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = false
  soft_delete_retention_days = 7

  # Private endpoints come with the hub-and-spoke network.
  public_network_access_enabled = true

  tags = var.tags
}

resource "azurerm_role_assignment" "admin" {
  for_each = toset(var.admin_object_ids)

  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = each.value
}

output "id" {
  value = azurerm_key_vault.this.id
}

output "uri" {
  value = azurerm_key_vault.this.vault_uri
}
