
data "azurerm_client_config" "current" {
}

resource "azurerm_resource_group" "state_rg" {
  name     = "terraform-state"
  location = "West Europe"
}

resource "azurerm_storage_account" "state_bucket" {
  name                      = "jumphoststate"
  account_tier              = "Standard"
  account_replication_type  = var.account_replication_type
  enable_https_traffic_only = true
  min_tls_version           = "TLS1_2"
  resource_group_name       = "terraform-state"
  location                  = var.location

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices", "Logging", "Metrics"]
    ip_rules       = var.allowed_ips
  }

  lifecycle {
    #prevent_destroy = true
    ignore_changes = [
      network_rules
    ]
  }
}

module "environment-base" {

  source = "./modules/environment-base"

  for_each = var.environment

  # Project settings
  environment      = each.value
  location         = var.location
  resource_group   = "${var.resource_group}-${each.value}"
  subscription_id  = data.azurerm_client_config.current.subscription_id
  tenant_id        = data.azurerm_client_config.current.tenant_id
  runner_object_id = data.azurerm_client_config.current.object_id
  allowed_ips      = var.allowed_ips

  # Identities
  admin_identity = "${each.value}-identity"
  admin_users    = var.admin_users

  # Virtual Network
  vnet_name          = var.vnet_name
  vnet_address_space = var.vnet_address_space
  vnet_subnet_name   = var.vnet_subnet_name
  subnet_prefixes    = ["10.0.0.0/8"]

  # Container Registry
  cr_name                       = var.cr_name
  cr_sku                        = var.cr_sku[each.key]
  public_network_access_enabled = var.public_network_access_enabled[each.key]

  # Storage
  storage_acct_name        = var.storage_acct_name
  account_tier             = var.account_tier[each.key]
  account_replication_type = var.account_replication_type
  log_storage_tier         = var.log_storage_tier

  #KeyVault
  kv_name    = "${each.value}-${var.kv_name}"
  kv_sku_ame = var.kv_sku_name[each.key]
}

module "virtual-machine-scale-set" {
  source   = "./modules/virtual-machine-scale-set"
  for_each = var.environment

  # Project settings
  environment    = each.value
  location       = var.location
  resource_group = "${var.resource_group}-${each.value}"
  allowed_ips    = var.allowed_ips

  # Virtual Network
  vnet_name              = var.vnet_name
  vnet_subnet_name       = var.vnet_subnet_name
  subnet_prefixes        = ["10.0.0.0/27"]
  network_security_group = module.environment-base[each.key].network_security_group

  # KeyVault
  kv_name     = "${each.value}-${var.kv_name}"
  kv_id       = module.environment-base[each.key].kv_id
  kv_key_name = var.kv_key_name
  kv_key_type = var.kv_key_type
  kv_key_size = var.kv_key_size

  # Virtual Machine Network Interface
  vm_net_iface_name                          = var.vm_net_iface_name
  vm_net_iface_ipconfig_name                 = var.vm_net_iface_ipconfig_name
  vm_net_iface_private_ip_address_allocation = var.vm_net_iface_private_ip_address_allocation

  # Virtual Machine
  vm_name           = var.vm_name
  vm_computer_name  = var.vm_computer_name
  vm_size           = var.vm_size[each.key]
  vm_admin_username = var.vm_admin_username
  admin_users       = ["${module.environment-base[each.key].managed_identity_id}"]

  # Virtual Machine Disk
  vm_os_disk_caching        = var.vm_os_disk_caching
  vm_os_disk_size_gb        = var.vm_os_disk_size_gb[each.key]
  vm_storage_account_type   = var.vm_storage_account_type
  vm_source_image_publisher = var.vm_source_image_publisher
  vm_source_image_offer     = var.vm_source_image_offer
  vm_source_image_sku       = var.vm_source_image_sku
  vm_source_image_verson    = var.vm_source_image_verson

  # Logs
  storage_account_url = module.environment-base[each.key].storage_account.primary_blob_endpoint

  depends_on = [
    module.environment-base
  ]
}

