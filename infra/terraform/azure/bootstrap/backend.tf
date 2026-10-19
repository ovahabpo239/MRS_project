# Partial config: the account details come from ../backend.hcl, which the first bootstrap run
# writes. That first run swaps this block for a local backend (see infra/scripts/bootstrap.sh),
# because the storage account it points at does not exist yet.
terraform {
  backend "azurerm" {
    key = "bootstrap.tfstate"
  }
}
