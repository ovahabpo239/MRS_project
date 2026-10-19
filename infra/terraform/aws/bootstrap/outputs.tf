output "backend_hcl" {
  description = "Partial backend config shared by every stack. bootstrap.sh writes it to ../backend.hcl."
  value       = <<-EOT
    bucket       = "${aws_s3_bucket.tfstate.id}"
    region       = "${var.region}"
    encrypt      = true
    use_lockfile = true
  EOT
}

output "github_variables" {
  description = "Repository variables for .github/workflows/infra-aws.yml (Settings > Secrets and variables > Actions > Variables)."
  value = {
    AWS_ROLE_ARN = aws_iam_role.github.arn
    AWS_REGION   = var.region
  }
}

output "permissions_boundary_arn" {
  description = "Boundary every environment role must carry so CI is allowed to create it."
  value       = local.permissions_boundary_arn
}
