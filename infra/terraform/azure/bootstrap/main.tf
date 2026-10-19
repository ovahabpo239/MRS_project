# Permanent layer: everything that must survive an ephemeral teardown. It costs cents per month
# and is applied by hand (make cloud-bootstrap), never by CI.

provider "azurerm" {
  features {}

  # The state account has shared keys disabled, so data-plane calls must use Entra ID.
  storage_use_azuread = true
}

data "azurerm_client_config" "current" {}

data "azurerm_subscription" "current" {}

locals {
  # Stable per subscription, so a rebuilt bootstrap gets the same globally unique names.
  suffix = substr(sha256(data.azurerm_subscription.current.subscription_id), 0, 8)

  tags = {
    project    = var.project
    lifecycle  = "permanent"
    managed_by = "terraform"
    component  = "bootstrap"
  }

  # Roles CI may hand out while building an ephemeral environment. Anything else, notably Owner
  # and User Access Administrator, is refused by the condition on its RBAC Administrator grant.
  delegable_roles = {
    aks_rbac_cluster_admin  = "b1ff04bb-8a4e-4dc4-8eb5-8693973ce19b"
    key_vault_administrator = "00482a5a-887f-4fb3-b363-3b7fe8e74483"
    key_vault_secrets_user  = "4633458b-17de-408a-b874-0445c86b69e6"
    network_contributor     = "4d97b98b-1d4f-4787-a291-c67834d212e7"
  }
  delegable_role_ids = join(", ", values(local.delegable_roles))
}

resource "azurerm_resource_group" "shared" {
  name     = "rg-${var.project}-shared"
  location = var.location
  tags     = local.tags
}

resource "azurerm_management_lock" "shared" {
  name       = "do-not-delete"
  scope      = azurerm_resource_group.shared.id
  lock_level = "CanNotDelete"
  notes      = "Holds Terraform state for every environment. Ephemeral cleanups must never remove it."
}

# --- Terraform state -------------------------------------------------------------------------

resource "azurerm_storage_account" "tfstate" {
  name                            = "st${var.project}tf${local.suffix}"
  resource_group_name             = azurerm_resource_group.shared.name
  location                        = azurerm_resource_group.shared.location
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 7
    }

    container_delete_retention_policy {
      days = 7
    }
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.tfstate.id
  container_access_type = "private"

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_role_assignment" "state_access" {
  for_each = {
    operator = data.azurerm_client_config.current.object_id
    github   = azurerm_user_assigned_identity.github.principal_id
  }

  scope                = azurerm_storage_account.tfstate.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = each.value
}

# --- CI identity (GitHub Actions OIDC, no stored secrets) -------------------------------------

resource "azurerm_user_assigned_identity" "github" {
  name                = "id-${var.project}-github"
  resource_group_name = azurerm_resource_group.shared.name
  location            = azurerm_resource_group.shared.location
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "github" {
  for_each = {
    main         = "ref:refs/heads/main"
    pull-request = "pull_request"
    environment  = "environment:${var.github_environment}"
  }

  name                      = "github-${each.key}"
  user_assigned_identity_id = azurerm_user_assigned_identity.github.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.github_repository}:${each.value}"
}

# Ephemeral resource groups do not exist before an apply, so the grants have to be at
# subscription scope.
resource "azurerm_role_assignment" "github_contributor" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "github_rbac_admin" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Role Based Access Control Administrator"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
  principal_type       = "ServicePrincipal"
  condition_version    = "2.0"
  condition            = <<-EOT
    (
     (
      !(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})
     )
     OR
     (
      @Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${local.delegable_role_ids}}
     )
    )
    AND
    (
     (
      !(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})
     )
     OR
     (
      @Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${local.delegable_role_ids}}
     )
    )
  EOT
}

# --- Cost guardrail ---------------------------------------------------------------------------

# Subscription-wide on purpose: the credit is shared by everything in the subscription.
resource "azurerm_consumption_budget_subscription" "monthly" {
  name            = "budget-${var.project}-monthly"
  subscription_id = data.azurerm_subscription.current.id
  amount          = var.monthly_budget
  time_grain      = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00Z", plantimestamp())
  }

  dynamic "notification" {
    for_each = {
      actual-50    = { threshold = 50, type = "Actual" }
      actual-80    = { threshold = 80, type = "Actual" }
      actual-100   = { threshold = 100, type = "Actual" }
      forecast-100 = { threshold = 100, type = "Forecasted" }
    }

    content {
      enabled        = true
      threshold      = notification.value.threshold
      threshold_type = notification.value.type
      operator       = "GreaterThanOrEqualTo"
      contact_emails = var.budget_contact_emails
    }
  }

  lifecycle {
    # The start date only matters at creation; recomputing it every month would churn the plan.
    ignore_changes = [time_period]
  }
}
