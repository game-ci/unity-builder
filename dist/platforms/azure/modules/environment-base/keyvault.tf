##############################
# Azure Keyvault and Secrets #
##############################

# make up a name for the keyvault
resource "random_pet" "key_vault" {
  length    = 2
  separator = "x"
}

# create the keyvault
resource "azurerm_key_vault" "key_vault" {

  name                       = random_pet.key_vault.id
  location                   = azurerm_resource_group.resource_group.location
  resource_group_name        = azurerm_resource_group.resource_group.name
  tenant_id                  = azurerm_user_assigned_identity.admin_identity.tenant_id
  sku_name                   = var.kv_sku_ame
  soft_delete_retention_days = 7
  purge_protection_enabled   = false


  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    ip_rules       = var.allowed_ips
  }

  depends_on = [
    random_pet.key_vault
  ]
  lifecycle {
    ignore_changes = [
      network_acls
    ]
  }
}

# squash our list of users and list of generated ids into a single list
locals {
  generated_users = tolist(["${azurerm_user_assigned_identity.admin_identity.principal_id}", "${var.runner_object_id}"])
  all_users       = concat(var.admin_users, local.generated_users)
}

# grant pemrissions to all in the list so we can access the vault we just created
resource "azurerm_key_vault_access_policy" "admins" {
  count = length(local.all_users)

  key_vault_id = azurerm_key_vault.key_vault.id
  tenant_id    = var.tenant_id
  object_id    = local.all_users[count.index]

  certificate_permissions = [
    "Backup", "Create", "Delete", "DeleteIssuers", "Get", "GetIssuers", "Import", "List", "ListIssuers", "ManageContacts", "ManageIssuers", "Purge", "Recover", "Restore", "SetIssuers", "Update"
  ]

  key_permissions = [
    "Get", "Backup", "Create", "Delete", "Decrypt", "Encrypt", "List", "Import", "Purge", "Recover", "Restore", "Sign", "Update", "Verify"
  ]

  secret_permissions = [
    "Get", "Delete", "Backup", "List", "Set", "Purge", "Restore", "Recover"
  ]

  depends_on = [
    azurerm_key_vault.key_vault, azurerm_user_assigned_identity.admin_identity
  ]
}

