################################
# Location and Project settings
################################
resource_group  = "scaleset"
location        = "West Europe"
subscription_id = "d520e0d1-8ce2-4bf3-bb06-443ee372cfec"
tenant_id       = "883785d3-d65d-4088-aca9-4deeb6cf92dc"
allowed_ips     = ["178.85.156.146"]
admin_users     = ["4b036f16-1f92-49be-a31d-3e2569b5e7fa"]

################################
# Environents to create/manage
################################

environment = {
  0 : "blue",
  1 : "green"
}

################################
# resource sizing
################################
account_tier = {
  # Defines the Tier to use for this storage account. 
  # Valid options are Standard and Premium. For BlockBlobStorage and FileStorage accounts only Premium is valid
  0 : "Standard",
  1 : "Standard",
}
cr_sku = {
  # SKU for the container registry: Basic, Standard and Premium.
  # Disabling public network access is not supported for the SKU Basic or Standard.
  0 : "Standard",
  1 : "Premium"
}
public_network_access_enabled = {
  0 : true,
  1 : true
}
kv_sku_name = {
  # SKU of the keyvault service: standard and premium
  0 : "standard",
  1 : "standard"
}
vm_size = {
  # https://docs.microsoft.com/en-us/azure/virtual-machines/sizes-b-series-burstable
  0 : "Standard_B1s",
  1 : "Standard_B1s"
}
vm_os_disk_size_gb = {
  # VM disk size in GB
  0 : "30",
  1 : "30"
}
vm_data_disk_size_gb = {
  # VM disk size in GB
  0 : "30",
  1 : "30"
}
write_accelerator_enabled = {
  0: false,
  1: false
}
accelerated_networking = {
  0: false
  1: false
}

###########################
# Virtual Network settings
############################
vnet_name          = "virtual-cage"
vnet_address_space = ["10.0.0.0/8"]
vnet_subnet_name   = "internal-subnet"

###########################
# Container Registry Name
###########################
cr_name = "cloudyCR"

###########################
# KeyVault and Key Settings
###########################
kv_name     = "cloudyKV"
kv_key_name = "generated-key"
kv_key_type = "RSA"
kv_key_size = 2048

###########################
# Virtual Machine Settings
###########################
vm_name          = "virtualmachine"
vm_computer_name = "cloudy-vm"

# changing this name will also have to be updated int he CI pipelines 
vm_admin_username = "cloudymax"

# Network iterface
vm_net_iface_name                          = "vm-nic"
vm_net_iface_ipconfig_name                 = "vm-nic-config"
vm_net_iface_private_ip_address_allocation = "Dynamic"

# Virtual Machine Disk
# az vm image list --all --publisher Canonical --sku "22_04-daily-lts-gen2" --query "[*].{version:version,architecture:architecture,sku:sku,offer:offer,version:version}" --output table 
# choose the latest version
vm_os_disk_caching        = "ReadWrite"
vm_storage_account_type   = "Standard_LRS"
vm_source_image_publisher = "Canonical"
vm_source_image_offer     = "0001-com-ubuntu-server-jammy-daily"
vm_source_image_sku       = "22_04-daily-lts-gen2"
vm_source_image_verson    = "22.04.202209270"

###########################
# Log Settings
###########################
detailed_error_messages = true
failed_request_tracing  = true
log_level               = "Information"
log_retention_in_days   = 30
sas_url                 = ""

###########################
# Log storage options
###########################
logs_enabled             = true
storage_acct_name        = "xlogxbucketx"
account_replication_type = "LRS"
log_storage_tier         = "Hot"
