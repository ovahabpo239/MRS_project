output "backend_hcl" {
  description = "Partial backend config shared by every stack. bootstrap.sh writes it to ../backend.hcl."
  value       = <<-EOT
    resource_group_name  = "${azurerm_resource_group.shared.name}"
    storage_account_name = "${azurerm_storage_account.tfstate.name}"
    container_name       = "${azurerm_storage_container.tfstate.name}"
    use_azuread_auth     = true
  EOT
}

output "github_variables" {
  description = "Repository variables for .github/workflows/infra.yml (Settings > Secrets and variables > Actions > Variables)."
  value = {
    AZURE_CLIENT_ID       = azurerm_user_assigned_identity.github.client_id
    AZURE_TENANT_ID       = data.azurerm_client_config.current.tenant_id
    AZURE_SUBSCRIPTION_ID = data.azurerm_subscription.current.subscription_id
  }
}
