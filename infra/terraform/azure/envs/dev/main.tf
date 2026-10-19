# Ephemeral layer: everything that costs money. Built and destroyed every iteration
# (make cloud-up / cloud-down); infra/scripts/azure/nuke.sh is the safety net if a destroy is skipped.

provider "azurerm" {
  features {
    # Stable names only work if nothing lingers in soft-delete after a destroy.
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = false
    }

    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

data "azurerm_client_config" "current" {}

locals {
  env  = "dev"
  name = "${var.project}-${local.env}"

  # Same value on every rebuild, so names are predictable; unique enough for global names.
  suffix = substr(sha256(data.azurerm_client_config.current.subscription_id), 0, 6)

  admin_object_ids = distinct(concat([data.azurerm_client_config.current.object_id], var.admin_object_ids))

  # nuke.sh selects on project + lifecycle; component feeds the per-component cost view.
  tags = {
    project    = var.project
    env        = local.env
    lifecycle  = "ephemeral"
    managed_by = "terraform"
  }
}

resource "azurerm_resource_group" "env" {
  name     = "rg-${local.name}"
  location = var.location
  tags     = merge(local.tags, { component = "platform" })
}

module "network" {
  source = "../../modules/network"

  name                = local.name
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  tags                = merge(local.tags, { component = "network" })
}

module "aks" {
  source = "../../modules/aks"

  name                = local.name
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  subnet_id           = module.network.aks_subnet_id
  kubernetes_version  = var.kubernetes_version
  system_vm_size      = var.system_vm_size
  app_vm_size         = var.app_vm_size
  app_max_count       = var.app_max_count
  admin_object_ids    = local.admin_object_ids
  tags                = merge(local.tags, { component = "aks" })
}

module "keyvault" {
  source = "../../modules/keyvault"

  name                = "kv-${local.name}-${local.suffix}"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  admin_object_ids    = local.admin_object_ids
  tags                = merge(local.tags, { component = "secrets" })
}
