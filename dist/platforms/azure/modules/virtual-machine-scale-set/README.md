# Azure Virtual Machines

This module will create a Virtual Machine that integrates with the `environment-base` module. 

Creates:

- Subnet on the main virtual network
- Public IP address
- Virtual Network Interface
- Virtual Disk
- Public and Private RSA Key Pair inside the main key-vault
- Linux Virtual Machine
- Bastion login device



## Usage

```hcl
module "virtual-machine" {
  source   = "./modules/virtual-machine"
  for_each = var.environment

  # Project settings
  environment          = each.value
  location             = var.location
  resource_group       = "${var.resource_group}-${each.value}"
  secret_rotation_days = var.secret_rotation_days

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

```
