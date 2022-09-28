variable "environment" {
  description = "deployment environment - dev/staging/prod"
  type        = string
  default     = "dev"
}

variable "resource_group" {
  description = "the azure resource group that will hold our stuff"
  type        = string
}

variable "location" {
  description = "geo region where our items will be created"
  type        = string
  default     = "West Europe"
}

variable "subnet_prefixes" {
  description = "internal subnet prefixes"
  type        = list(any)
}

variable "vm_net_iface_name" {
  description = "The name of the Network Interface. Changing this forces a new resource to be created."
  type        = string
}

variable "vm_net_iface_ipconfig_name" {
  description = "A name used for this IP Configuration."
  type        = string
}

variable "vm_net_iface_private_ip_address_allocation" {
  description = "The allocation method used for the Private IP Address. Possible values are Dynamic and Static"
  type        = string
}

variable "vm_name" {
  description = "The name of the Linux Virtual Machine. Changing this forces a new resource to be created."
  type        = string
}

variable "vm_computer_name" {
  description = "The hostname of the Linux Virtual Machine. Changing this forces a new resource to be created."
  type        = string
}

variable "vm_size" {
  description = "The SKU which should be used for this Virtual Machine, such as Standard_F2."
  type        = string
}

variable "vm_admin_username" {
  description = "The username of the local administrator used for the Virtual Machine. Changing this forces a new resource to be created."
  type        = string
}

variable "vm_os_disk_caching" {
  description = "The Type of Caching which should be used for the Internal OS Disk. Possible values are None, ReadOnly and ReadWrite."
  type        = string
}

variable "vm_os_disk_size_gb" {
  description = "The Size of the Internal OS Disk in GB, if you wish to vary from the size used in the image this Virtual Machine is sourced from."

}

variable "vm_storage_account_type" {
  description = "The Type of Storage Account which should back this the Internal OS Disk. Possible values are Standard_LRS, StandardSSD_LRS, Premium_LRS, StandardSSD_ZRS and Premium_ZRS. Changing this forces a new resource to be created."
  type        = string
}

variable "storage_account_url" {
  description = "where to send logs"
  type        = string
}


variable "vm_source_image_publisher" {
  description = "Specifies the publisher of the image used to create the virtual machines."
  type        = string
}

variable "vm_source_image_offer" {
  description = "Specifies the offer of the image used to create the virtual machines. az vm image list --all --publisher Canonical --offer 0001-com-ubuntu-server-jammy-daily --output table"
  type        = string
}

variable "vm_source_image_sku" {
  description = "Specifies the SKU of the image used to create the virtual machines."
  type        = string
}

variable "vm_source_image_verson" {
  description = "Specifies the version of the image used to create the virtual machines."
  type        = string
}

variable "kv_id" {
  description = "ID for the keyvault"
  type        = string
}

variable "kv_name" {
  description = "Name for the keyvault"
  type        = string
}

variable "kv_key_name" {
  description = "Name for the ssh key"
  type        = string
}

variable "kv_key_type" {
  description = "type of key to create: Possible values are EC (Elliptic Curve), EC-HSM, Oct (Octet), RSA and RSA-HSM"
  type        = string
}

variable "kv_key_size" {
  description = "Specifies the Size of the RSA key to create in bytes. For example, 1024 or 2048. Note: This field is required if key_type is RSA or RSA-HSM"
  type        = number
}

variable "vnet_name" {
  description = "name of the outer-most virtual network boundary"
  type        = string
}

variable "vnet_subnet_name" {
  description = "internal subnet name"
  type        = string
}

variable "network_security_group" {
  description = "security group to attach to"
  type        = any
}

variable "admin_users" {
  description = "object_id's for users /groups that will get admin access to things"
  type        = list(string)
}

variable "allowed_ips" {
  description = "addresses allowed to access the infra"
  type        = list(string)
}
