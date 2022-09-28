# Base Environment

This module will create the basic building-blocks for a deployment environment (Dev/Test/Prod).

## Resource Group

- A resource group to hold all the resources for this environment

## Accounts and Identities

- A Managed Identity owned by the terraform runner w/ a randomly generated name
- An azure application owned by the terraform runner
- An azure service principal assigned to the application and owned by the terraform runner

## Container Registry

- A container Registry with a randomized name assigned to the managed identity
- A container registry webhook (currently created but unused)

## Keys and Secrets

- An Azure Key Vault with a random name
- An azure Key Vault Access Policy for the terraform runner, and managed identity

## Storage

- An Azure Storage Account 
- An azure blob container
- Azure SAS urls (move to app service module)
- A rotating time resource for certificate expiration

## Networking

- A top-level virtual network
- A network security group
- Inbound and Outbound security rules

## Usage

```hcl
module "environment-base" {

  source = "./environment-base"

  for_each = var.environment

  # Project settings
  environment      = each.value
  location         = var.location
  resource_group   = "${var.resource_group}-${each.value}"
  subscription_id  = data.azurerm_client_config.current.subscription_id
  tenant_id        = data.azurerm_client_config.current.tenant_id
  runner_object_id = data.azurerm_client_config.current.object_id

  # Identities
  admin_identity = "${each.value}-identity"

  # Virtual Network
  vnet_name          = var.vnet_name
  vnet_address_space = var.vnet_address_space
  vnet_subnet_name   = var.vnet_subnet_name
  subnet_prefixes    = ["10.0.1.0/16"]

  # Container Registry
  cr_name = var.cr_name
  cr_sku  = var.cr_sku[each.key]

  # Storage
  storage_acct_name        = var.storage_acct_name
  account_tier             = var.account_tier[each.key]
  account_replication_type = var.account_replication_type
  log_storage_tier         = var.log_storage_tier

  #KeyVault
  kv_name    = "${each.value}-${var.kv_name}"
  kv_sku_ame = var.kv_sku_name[each.key]
}
```

## Outputs

```hcl
output "kv_id" {
  value = azurerm_key_vault.key_vault.id
}
output "vnet_id" {
  value = azurerm_virtual_network.virtual_network.id
}
output "vnet_name" {
  value = azurerm_virtual_network.virtual_network.name
}
output "managed_identity" {
  value = azurerm_user_assigned_identity.admin_identity
}
output "managed_identity_name" {
  value = azurerm_user_assigned_identity.admin_identity.name
}
output "managed_identity_client_id" {
  value = azurerm_user_assigned_identity.admin_identity.client_id
}
output "managed_identity_id" {
  value = azurerm_user_assigned_identity.admin_identity.id
}
output "storage_account" {
  value = azurerm_storage_account.storage_account
}
output "log_contaier" {
  value = azurerm_storage_container.log_container
}
output "log_contaier_id" {
  value = azurerm_storage_container.log_container.id
}
output "log_contaier_sas" {
  value = data.azurerm_storage_account_blob_container_sas.website_logs_container_sas.sas
}
output "conatiner_registry" {
  value = azurerm_container_registry.container_registry
}
output "network_security_group" {
  value = azurerm_network_security_group.netsec_group
}
```