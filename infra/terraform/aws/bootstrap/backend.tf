# Partial config: the bucket details come from ../backend.hcl, which the first bootstrap run
# writes. That first run swaps this block for a local backend (see infra/scripts/aws/bootstrap.sh),
# because the bucket it points at does not exist yet.
terraform {
  backend "s3" {
    key = "bootstrap.tfstate"
  }
}
