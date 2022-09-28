#!/bin/bash
########################################################################################
# This script will add the IP address of the current machine 
# to the firewalls (if they exist) of all environments
# You will need to ensure the IP address of the device you will
# be using to run terraform is added, or you wont be able to do anything.
# 
# Run `firewall.sh add` from the terraform runner to add it's IP to the firewalls. 
# Run `firewall.sh remove` to delete the IP address.
#
# - Max
##########################################################################################

get_values(){
    log "-- 🏞️ Environment: medicalvr-$1 🏞️--"
    log "🌎 Finding the public ip of the current machine..."
    export IP_ADDRESS=$(curl https://api.ipify.org)

    log "🪵  Finding the log storage container name..."
    export STORAGE_NAME=$(az storage account list --resource-group "medicalvr-$1" --query "[?contains(name, '$1logsnbackups')].name" -o tsv)

    log "🔐 Finding the key vault name..."
    export KV_NAME=$(az keyvault list --resource-group "medicalvr-$1" --query "[*].name" --output tsv)

    log "🔎 Finding ACR Name..."
    export ACR_NAME=$(az acr list --resource-group "medicalvr-$1" --query "[*].name" --output tsv)
}

add_to_firewalls(){
    get_values $1
    log "📡 Addding address to log storage firewall..."
    EXISTS=$(az storage account network-rule list --account-name $1logsnbackups --query "ipRules[*].ipAddressOrRange" --output tsv |grep -c "$IP_ADDRESS")
    if [ "$EXISTS" -eq "0" ]; then
        az storage account network-rule add \
            --resource-group "medicalvr-$1" \
            --account-name $STORAGE_NAME \
            --ip-address $IP_ADDRESS >> firewall.log
        log "  ➡️ done."
    else
        log "  ➡️ address already present."
    fi

    log "📡 Addding address to KeyVault Firewall..."
    EXISTS=$(az keyvault network-rule list --name $KV_NAME --query "ipRules[*].value" --output tsv |grep -c "$IP_ADDRESS")
    if [ "$EXISTS" -eq "0" ]; then
        az keyvault network-rule add \
            --name $KV_NAME \
            --resource-group "medicalvr-$1" \
            --ip-address $IP_ADDRESS >> firewall.log
            log "  ➡️ done."
    else
        log "  ➡️ address already present."
    fi

    log "📡 Adding address to ACR firewall..."
    EXISTS=$(az acr network-rule list -n $ACR_NAME --query "ipRules[*].ipAddressOrRange" --output tsv |grep -c "$IP_ADDRESS")
    if [ "$EXISTS" -eq "0" ]; then
    az acr network-rule add \
        -n $ACR_NAME \
        --ip-address $IP_ADDRESS >> firewall.log
        log "  ➡️ done."
    else
        log "  ➡️ address already present."
    fi
}

remove_from_firewalls(){
    get_values $1

    log "🧹 Removing address from log storage firewall..."
    EXISTS=$(az storage account network-rule list --account-name $1logsnbackups --query "ipRules[*].ipAddressOrRange" --output tsv |grep -c "$IP_ADDRESS")
    if [ "$EXISTS" -eq "1" ]; then
        az storage account network-rule remove \
            --resource-group "medicalvr-$1" \
            --account-name $STORAGE_NAME \
            --ip-address $IP_ADDRESS >> firewall.log
        log "  ➡️ done."
    else
        log "  ➡️ address already absent."
    fi
    
    log "🧹 Removing address from to KeyVault Firewall..."
    EXISTS=$(az keyvault network-rule list --name $KV_NAME --query "ipRules[*].value" --output tsv |grep -c "$IP_ADDRESS")
    if [ "$EXISTS" -eq "1" ]; then
        az keyvault network-rule remove \
            --name $KV_NAME \
            --resource-group "medicalvr-$1" \
            --ip-address $IP_ADDRESS >> firewall.log
            log "  ➡️ done."
    else
        log "  ➡️ address already absent."
    fi
    
    log "🧹 Removing address from to ACR firewall..."
    EXISTS=$(az acr network-rule list -n $ACR_NAME --query "ipRules[*].ipAddressOrRange" --output tsv |grep -c "$IP_ADDRESS")
    if [ "$EXISTS" -eq "1" ]; then
    az acr network-rule remove \
        -n $ACR_NAME \
        --ip-address $IP_ADDRESS >> firewall.log
        log "  ➡️ done."
    else
        log "  ➡️ address already absent."
    fi
}

add_to_state(){
    log "-- 🪣 State Bucket 🪣 --"
    log "Adding address to state storage firewall..."
    EXISTS=$(az storage account network-rule list --account-name "medicalvrterraformdata" --query "ipRules[*].ipAddressOrRange" --output tsv |grep -c "$IP_ADDRESS")
    if [ "$EXISTS" -eq "0" ]; then
       az storage account network-rule add \
           --resource-group "terraform-iac" \
           --account-name "medicalvrterraformdata" \
           --ip-address $IP_ADDRESS >> firewall.log
       log "  ➡️ done."
    else
           log "  ➡️ address already present."
    fi
}

remove_from_state(){
    log "-- 🪣 State Bucket 🪣 --"
    log "Removing address to state storage firewall..." 
    EXISTS=$(az storage account network-rule list --account-name "medicalvrterraformdata" --query "ipRules[*].ipAddressOrRange" --output tsv |grep -c "$IP_ADDRESS")   
    if [ "$EXISTS" -eq "1" ]; then
       az storage account network-rule remove \
           --resource-group "terraform-iac" \
           --account-name "medicalvrterraformdata" \
           --ip-address $IP_ADDRESS >> firewall.log
       log "  ➡️ done."
    else
           log "  ➡️ address already absent."
    fi
}

# Logging method
log() {
    echo >&2 -e "[$(date +"%Y-%m-%d %H:%M:%S")] ${1-}"
}

add(){
    add_to_firewalls development
    add_to_firewalls production
    add_to_state $IP_ADDRESS
    log "Waiting..."
    sleep 10
    log "Done!"
}

remove(){
    remove_from_firewalls development
    remove_from_firewalls production
    remove_from_state $IP_ADDRESS
}

"$@"
