output "region" {
  value = var.region
}

output "cluster_name" {
  value = module.eks.name
}

output "oidc_issuer_url" {
  description = "Cluster OIDC issuer, for IRSA if a tool does not support Pod Identity yet."
  value       = module.eks.oidc_issuer_url
}

output "secrets_kms_key_arn" {
  value = module.secrets.kms_key_arn
}

output "secrets_read_policy_arn" {
  description = "Attach to the External Secrets Operator Pod Identity role."
  value       = module.secrets.read_policy_arn
}

output "get_credentials" {
  description = "Writes a kubeconfig entry that authenticates through the AWS CLI."
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.name} --alias ${module.eks.name}"
}
