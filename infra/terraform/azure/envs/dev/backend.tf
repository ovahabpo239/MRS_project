# Account details come from ../../backend.hcl. infra/scripts/nuke.sh deletes this key, so a
# nuked environment starts again from empty state.
terraform {
  backend "azurerm" {
    key = "dev/platform.tfstate"
  }
}
