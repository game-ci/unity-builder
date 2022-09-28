variable "environment" {
  description = "deployment environment - dev/staging/prod"
  type        = map(any)
}

variable "allowed_ips" {
  description = "ip addresses allowed to access the infra"
  type        = list(string)
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

variable "minimum_tls_version" {
  description = "The configures the minimum version of TLS required for SSL requests. Possible values include: 1.0, 1.1, and 1.2. Defaults to 1.2."
  type        = number
  default     = 1.2
}

variable "detailed_error_messages" {
  description = "Should detailed error messages be enabled."
  type        = string
}

variable "failed_request_tracing" {
  description = "Should failed request tracing be enabled."
  type        = string
}

variable "log_level" {
  description = "Log level. Possible values include: Verbose, Information, Warning, and Error."
  type        = string
  default     = "Warning"
}

variable "log_retention_in_days" {
  description = "The time in days after which to remove blobs. A value of 0 means no retention."
  type        = number
  default     = 7
}

variable "sas_url" {
  description = "SAS url to an Azure blob container with read/write/list/delete permissions."
  type        = string
}

variable "vnet_name" {
  description = "name of the outer-most virtual network boundary"
  type        = string
}

variable "vnet_address_space" {
  description = "address space for the outer vnet"
  type        = list(any)
  default     = ["10.0.0.0/16"]
}

variable "vnet_subnet_name" {
  description = "internal subnet name"
  type        = string
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
  type        = map(any)
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
  type        = map(any)
}

variable "vm_storage_account_type" {
  description = "The Type of Storage Account which should back this the Internal OS Disk. Possible values are Standard_LRS, StandardSSD_LRS, Premium_LRS, StandardSSD_ZRS and Premium_ZRS. Changing this forces a new resource to be created."
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

variable "cr_name" {
  description = "Name for the container registry"
  type        = string
}

variable "cr_sku" {
  description = "SKU for the container registry: Basic, Standard and Premium."
  type        = map(any)
}

variable "kv_name" {
  description = "Name for the keyvault"
  type        = string
}

variable "kv_sku_name" {
  description = "SKU of the keyvault service: standard and premium"
  type        = map(any)
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

variable "storage_acct_name" {
  description = "Storage account name for the account that will hold out logs/backups"
  type        = string
}

variable "account_tier" {
  description = "logging storage account tier: Defines the Tier to use for this storage account. Valid options are Standard and Premium. For BlockBlobStorage and FileStorage accounts only Premium is valid. Changing this forces a new resource to be created."
  type        = map(any)
}

variable "account_replication_type" {
  description = " Defines the type of replication to use for this storage account. Valid options are LRS, GRS, RAGRS, ZRS, GZRS and RAGZRS. Changing this forces a new resource to be created when types LRS, GRS and RAGRS are changed to ZRS, GZRS or RAGZRS and vice versa."
  type        = string
}

variable "log_storage_tier" {
  description = "Defines the access tier for BlobStorage, FileStorage and StorageV2 accounts. Valid options are Hot and Cool, defaults to Hot"
  type        = string
}

variable "tenant_id" {
  description = "value"
  type        = string
}

variable "subscription_id" {
  description = "value"
  type        = string
}

variable "public_network_access_enabled" {
  description = "decide if the contaier registry will be locked dow or not, only available on premium tier"
}

variable "logs_enabled" {
  description = "Logs on/off"
  type        = bool
  default     = true
}

variable "admin_users" {
  description = "object_id's for users /groups that will get admin access to things"
  type        = list(string)
}
