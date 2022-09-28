#########################
# Azure Virtual Network #
#########################

# Top level virtual network
resource "azurerm_virtual_network" "virtual_network" {
  name                = "${var.environment}-${var.vnet_name}"
  address_space       = var.vnet_address_space
  location            = azurerm_resource_group.resource_group.location
  resource_group_name = azurerm_resource_group.resource_group.name
}

# Security group for the network that will hold our rules
resource "azurerm_network_security_group" "netsec_group" {
  name                = "netsec"
  resource_group_name = azurerm_resource_group.resource_group.name
  location            = azurerm_resource_group.resource_group.location

  tags = {
    environment = var.environment
  }

}

# Network Security rule to allow ssh form approved IPs
resource "azurerm_network_security_rule" "ssh" {
  name                        = "inboundSSH"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "22"
  source_address_prefixes      = var.allowed_ips
  destination_address_prefix  = "*"
  resource_group_name         = azurerm_resource_group.resource_group.name
  network_security_group_name = azurerm_network_security_group.netsec_group.name
}
