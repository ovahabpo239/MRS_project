output "resource_group_name" {
  value = azurerm_resource_group.env.name
}

output "cluster_name" {
  value = module.aks.name
}

output "oidc_issuer_url" {
  description = "Issuer for workload identity federated credentials."
  value       = module.aks.oidc_issuer_url
}

output "key_vault_uri" {
  value = module.keyvault.uri
}

output "get_credentials" {
  description = "Writes a kubeconfig entry. Entra-only clusters also need kubelogin (az aks install-cli)."
  value       = "az aks get-credentials -g ${azurerm_resource_group.env.name} -n ${module.aks.name} --overwrite-existing && kubelogin convert-kubeconfig -l azurecli"
}
