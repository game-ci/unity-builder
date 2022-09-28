##############################
# Virtual Machine Networking #
##############################

# Subnet for the VM
resource "azurerm_subnet" "vm_subnet" {
  name                 = "vm${var.vnet_subnet_name}"
  resource_group_name  = var.resource_group
  virtual_network_name = "${var.environment}-${var.vnet_name}"
  address_prefixes     = var.subnet_prefixes
}

# Create Network Security Group
resource "azurerm_network_security_group" "vm_security_group" {
  name                = "VmNetworkSecurityGroup"
  location            = var.location
  resource_group_name = var.resource_group
}

# Creates a firewall rule on the security group to allow SSH
resource "azurerm_network_security_rule" "example" {
  name                        = "SSH"
  priority                    = 1001 
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "22" 
  source_address_prefixes     = var.allowed_ips
  destination_address_prefix  = "*"
  resource_group_name         = var.resource_group
  network_security_group_name = azurerm_network_security_group.vm_security_group.name
}
