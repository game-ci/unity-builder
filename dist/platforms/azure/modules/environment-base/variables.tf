variable "admin_identity" {
  description = "Managed Identity created on deployment who will control the app services"
  type        = string
}

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

variable "vnet_name" {
  description = "name of the outer-most virtual network boundary"
  type        = string
}

variable "vnet_address_space" {
  description = "address space for the outer vnet"
  type        = list(any)
  default     = ["10.0.0.0/16"]
}

variable "allowed_ips" {
  description = "addresses allowed to access the infra"
  type        = list(string)
}

variable "vnet_subnet_name" {
  description = "internal subnet name"
  type        = string
}

variable "subnet_prefixes" {
  description = "internal subnet prefixes"
  type        = list(any)
}

variable "cr_name" {
  description = "Name for the container registry"
  type        = string
}

variable "cr_sku" {
  description = "SKU for the container registry: Basic, Standard and Premium."
  type        = string
}

variable "kv_name" {
  description = "Name for the keyvault"
  type        = string
}

variable "kv_sku_ame" {
  description = "SKU of the keyvault service: standard and premium"
  type        = string
}

variable "storage_acct_name" {
  description = "Storage account name for the account that will hold out logs/backups"
  type        = string
}

variable "account_tier" {
  description = "logging storage account tier: Defines the Tier to use for this storage account. Valid options are Standard and Premium. For BlockBlobStorage and FileStorage accounts only Premium is valid. Changing this forces a new resource to be created."
  type        = string
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

variable "runner_object_id" {
  description = "value"
  type        = string
}

variable "log_retention_in_days" {
  description = "The time in days after which to remove blobs. A value of 0 means no retention."
  type        = number
  default     = 7
}

variable "public_network_access_enabled" {
  description = "decide if the contaier registry will be locked dow or not, only available on premium tier"
}

variable "admin_users" {
  description = "object_id's for users /groups that will get admin access to things"
  type        = list(string)
}
