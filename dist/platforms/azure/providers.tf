terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.14.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~>2.26.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "~>3.3.1"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~>3.4.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~>0.7.2"
    }
    cloudinit = {
      source  = "hashicorp/cloudinit"
      version = "~>2.2.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state"
    storage_account_name = "jumphoststate"
    container_name       = "state"
    key                  = "dev.terraform.tfstate"
  }
}


provider "tls" {
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = false
    }
    virtual_machine {
      delete_os_disk_on_deletion     = true
      graceful_shutdown              = false
      skip_shutdown_and_force_delete = false
    }
  }
}

provider "azuread" {
}

provider "random" {
}

provider "time" {
}

provider "cloudinit" {
}

