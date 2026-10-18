# One VNet per environment with a subnet for AKS nodes. Pods use the overlay CIDR, so the node
# subnet stays small. Becomes a spoke once the hub-and-spoke network lands (spec 7.6).

terraform {
  required_version = ">= 1.15"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 5.10"
    }
  }
}

variable "name" {
  description = "Name stem, e.g. resonance-dev."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group that holds the network."
  type        = string
}

variable "location" {
  description = "Azure region."
  type        = string
}

variable "address_space" {
  description = "VNet address space."
  type        = string
  default     = "10.10.0.0/16"
}

variable "aks_subnet_prefix" {
  description = "Node subnet. A /22 leaves room for surge nodes during upgrades."
  type        = string
  default     = "10.10.0.0/22"
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
}

resource "azurerm_virtual_network" "this" {
  name                = "vnet-${var.name}"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = [var.address_space]
  tags                = var.tags
}

# No subnet NSG: AKS manages the NSG on its node NICs, and a subnet NSG with default rules would
# block inbound internet traffic to public LoadBalancer services.
resource "azurerm_subnet" "aks" {
  name                 = "snet-aks-nodes"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [var.aks_subnet_prefix]
}

output "vnet_id" {
  value = azurerm_virtual_network.this.id
}

output "aks_subnet_id" {
  value = azurerm_subnet.aks.id
}
