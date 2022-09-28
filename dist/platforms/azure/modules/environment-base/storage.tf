# key name 
resource "random_pet" "vault_encryption" {
  length    = 2
  separator = "x"
}

# Storage account with a container for logs and backups.
resource "azurerm_storage_account" "storage_account" {
  name                      = "${var.environment}${var.storage_acct_name}"
  resource_group_name       = azurerm_resource_group.resource_group.name
  location                  = azurerm_resource_group.resource_group.location
  account_tier              = var.account_tier
  account_replication_type  = var.account_replication_type
  enable_https_traffic_only = true
  min_tls_version           = "TLS1_2"

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices", "Logging", "Metrics"]
    ip_rules       = var.allowed_ips
  }

  identity {
    type = "UserAssigned"
    identity_ids = [
      azurerm_user_assigned_identity.admin_identity.id
    ]
  }

  lifecycle {
    #prevent_destroy = true
    ignore_changes = [
      network_rules
    ]
  }

}

# container for logs
resource "azurerm_storage_container" "log_container" {
  name                  = "jumphostlogs"
  storage_account_name  = azurerm_storage_account.storage_account.name
  container_access_type = "private"

  depends_on = [
    azurerm_storage_account.storage_account
  ]

  #lifecycle {
  #  prevent_destroy = true
  #}
}

