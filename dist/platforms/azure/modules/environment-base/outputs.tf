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
  value = {
    name                           = "${azurerm_storage_account.storage_account.name}"
    id                             = "${azurerm_storage_account.storage_account.id}"
    primary_access_key             = "${azurerm_storage_account.storage_account.primary_access_key}"
    primary_blob_endpoint          = "${azurerm_storage_account.storage_account.primary_blob_endpoint}"
    primary_connection_string      = "${azurerm_storage_account.storage_account.primary_connection_string}"
    primary_blob_connection_string = "${azurerm_storage_account.storage_account.primary_blob_connection_string}"
  }
}
output "log_contaier" {
  value = azurerm_storage_container.log_container
}
output "log_contaier_id" {
  value = azurerm_storage_container.log_container.id
}
output "conatiner_registry" {
  value = azurerm_container_registry.container_registry
}
output "network_security_group" {
  value = azurerm_network_security_group.netsec_group
}
output "container_registry_admin_username" {
  value = azurerm_container_registry.container_registry.admin_username
}
output "container_registry_admin_password" {
  value     = azurerm_container_registry.container_registry.admin_password
  sensitive = true
}
output "container_registry_server_url" {
  value = azurerm_container_registry.container_registry.login_server
}
