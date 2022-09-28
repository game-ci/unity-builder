##################################
# Azure Virtual Machine Scale Set#
##################################

# Cloud-init file that will provision each machine as it boots
data "template_file" "cloudconfig" {
  template = "${file("${path.module}/cloud-init.txt")}"
}

# formatting the cloud-init file for azure
data "template_cloudinit_config" "config" {
  gzip          = true
  base64_encode = true

  part {
    content_type = "text/cloud-config"
    content      = "${data.template_file.cloudconfig.rendered}"
  }
}

# create a password for the virtual machine
resource "random_password" "vm_admin_password" {
  length  = 16
  special = false
}

# add the password to the keyvault
resource "azurerm_key_vault_secret" "vm_admin_password" {
  name         = "${var.environment}vmadmin"
  value        = "${random_password.vm_admin_password.result}"
  content_type = "text/plain"
  key_vault_id = var.kv_id
}

# create the virtual machine scale set
resource "azurerm_linux_virtual_machine_scale_set" "virtual_machine" {
  name                            = "${var.environment}-${var.vm_name}"
  resource_group_name             = var.resource_group
  location                        = var.location
  sku                             = var.vm_size
  instances                       = 1
  admin_username                  = var.vm_admin_username
  admin_password                  = random_password.vm_admin_password.result
  #allow_extension_operations     = false
  disable_password_authentication = false
  computer_name_prefix            = var.vm_computer_name

  # this is the cloud-init data
  custom_data = "${data.template_cloudinit_config.config.rendered}"

  network_interface {
    name = var.vm_net_iface_name
    enable_accelerated_networking = false
    enable_ip_forwarding = true
    network_security_group_id = azurerm_network_security_group.vm_security_group.id
    primary = true
  
    ip_configuration {
      name = var.vm_net_iface_ipconfig_name
      primary = true
      subnet_id = azurerm_subnet.vm_subnet.id
    
      public_ip_address {
        name = "vmpip"
      }
    }

  }

  os_disk {
    caching              = var.vm_os_disk_caching
    storage_account_type = var.vm_storage_account_type
    disk_size_gb         = var.vm_os_disk_size_gb
    write_accelerator_enabled = false
  }

  data_disk {
    caching = "ReadWrite"
    create_option = "Empty"
    disk_size_gb  = "32"
    lun = "1"
    storage_account_type = "Standard_LRS"
    write_accelerator_enabled = false
  }

  source_image_reference {
    publisher = var.vm_source_image_publisher
    offer     = var.vm_source_image_offer
    sku       = var.vm_source_image_sku
    version   = var.vm_source_image_verson
  }

  timeouts {
    create = "6m"
    update = "6m"
    delete = "6m"
  }

  boot_diagnostics {
    storage_account_uri = var.storage_account_url
  }

  identity {
    type         = "UserAssigned"
    identity_ids = var.admin_users
  }

  depends_on = [
    data.template_cloudinit_config.config 
  ]

}
