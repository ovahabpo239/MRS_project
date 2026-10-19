# Small, disposable AKS cluster: free control plane, one system node, an app pool that scales to
# zero, Entra ID login only, and workload identity for pods (spec 7.6).

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
  description = "Resource group for the cluster resource itself."
  type        = string
}

variable "location" {
  description = "Azure region."
  type        = string
}

variable "tenant_id" {
  description = "Entra tenant used for cluster login."
  type        = string
}

variable "subnet_id" {
  description = "Node subnet."
  type        = string
}

variable "kubernetes_version" {
  description = "Pinned Kubernetes version, or null for the region default."
  type        = string
  default     = null
}

variable "system_vm_size" {
  description = "VM size of the system pool. AKS needs at least 2 vCPU and 4 GiB."
  type        = string
  default     = "Standard_D2als_v7"
}

variable "system_node_count" {
  description = "Nodes in the system pool."
  type        = number
  default     = 1
}

variable "app_vm_size" {
  description = "VM size of the autoscaled app pool."
  type        = string
  default     = "Standard_D2as_v7"
}

variable "app_min_count" {
  description = "Minimum app pool nodes. 0 lets the pool idle at no cost."
  type        = number
  default     = 0
}

variable "app_max_count" {
  description = "Maximum app pool nodes."
  type        = number
  default     = 2
}

variable "os_disk_size_gb" {
  description = "Node OS disk size. 32 GB lands in the cheapest managed disk tier."
  type        = number
  default     = 32
}

variable "admin_object_ids" {
  description = "Entra object IDs granted Azure Kubernetes Service RBAC Cluster Admin."
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
}

# A user-assigned control-plane identity, so Network Contributor on the subnet exists before the
# cluster does. With a system-assigned identity the first create can race the role assignment.
resource "azurerm_user_assigned_identity" "control_plane" {
  name                = "id-aks-${var.name}"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags
}

resource "azurerm_role_assignment" "subnet" {
  scope                = var.subnet_id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_user_assigned_identity.control_plane.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_kubernetes_cluster" "this" {
  name                      = "aks-${var.name}"
  resource_group_name       = var.resource_group_name
  location                  = var.location
  dns_prefix                = var.name
  node_resource_group       = "rg-${var.name}-nodes"
  kubernetes_version        = var.kubernetes_version
  sku_tier                  = "Free"
  automatic_upgrade_channel = "patch"
  node_os_upgrade_channel   = "NodeImage"

  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  local_account_disabled            = true
  role_based_access_control_enabled = true

  azure_active_directory_role_based_access_control {
    azure_rbac_enabled = true
    tenant_id          = var.tenant_id
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.control_plane.id]
  }

  # Classic node pools with the cluster autoscaler, not node auto-provisioning (Karpenter).
  node_provisioning_profile {
    mode = "Manual"
  }

  default_node_pool {
    name                        = "system"
    vm_size                     = var.system_vm_size
    node_count                  = var.system_node_count
    vnet_subnet_id              = var.subnet_id
    os_disk_size_gb             = var.os_disk_size_gb
    temporary_name_for_rotation = "systemtmp"
    tags                        = var.tags

    upgrade_settings {
      max_surge = "10%"
    }
  }

  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    network_data_plane  = "cilium"
    network_policy      = "cilium"
    pod_cidr            = "10.244.0.0/16"
    service_cidr        = "10.100.0.0/16"
    dns_service_ip      = "10.100.0.10"
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"
  }

  tags = var.tags

  depends_on = [azurerm_role_assignment.subnet]
}

resource "azurerm_kubernetes_cluster_node_pool" "app" {
  name                        = "app"
  kubernetes_cluster_id       = azurerm_kubernetes_cluster.this.id
  mode                        = "User"
  vm_size                     = var.app_vm_size
  vnet_subnet_id              = var.subnet_id
  os_disk_size_gb             = var.os_disk_size_gb
  auto_scaling_enabled        = true
  min_count                   = var.app_min_count
  max_count                   = var.app_max_count
  temporary_name_for_rotation = "apptmp"
  tags                        = var.tags

  upgrade_settings {
    max_surge = "10%"
  }
}

resource "azurerm_role_assignment" "cluster_admin" {
  for_each = toset(var.admin_object_ids)

  scope                = azurerm_kubernetes_cluster.this.id
  role_definition_name = "Azure Kubernetes Service RBAC Cluster Admin"
  principal_id         = each.value
}

output "name" {
  value = azurerm_kubernetes_cluster.this.name
}

output "id" {
  value = azurerm_kubernetes_cluster.this.id
}

output "oidc_issuer_url" {
  value = azurerm_kubernetes_cluster.this.oidc_issuer_url
}

output "node_resource_group" {
  value = azurerm_kubernetes_cluster.this.node_resource_group
}
