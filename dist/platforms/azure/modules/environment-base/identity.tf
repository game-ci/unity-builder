####################
# AzureRM Identity #
####################

# get the credentials of the terraform user
data "azuread_client_config" "current" {}

# generate a ranomd identity name
resource "random_pet" "identity" {
  length    = 2
  separator = "x"
}

# create the user-assigned managed identity
resource "azurerm_user_assigned_identity" "admin_identity" {
  resource_group_name = azurerm_resource_group.resource_group.name
  location            = azurerm_resource_group.resource_group.location

  name = random_pet.identity.id

  depends_on = [
    random_pet.identity
  ]
}
