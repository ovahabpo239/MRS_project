# Bucket details come from ../../backend.hcl. infra/scripts/aws/nuke.sh deletes this key, so a
# nuked environment starts again from empty state.
terraform {
  backend "s3" {
    key = "dev/platform.tfstate"
  }
}
