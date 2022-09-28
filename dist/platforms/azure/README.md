# Azure Taregt

This terraform project will set up a pre-defined number of ephemeral, isolated, and scalable VM pools on Azure that can be used as self-hosted runners and other things. You will need an Azure Account, a subscription, the azure cli, and access to a machine that can run docker. Please be aware that while this demo uses the minimum possible billable srvices, costs may still be incurred from usage amounts, changing vm sizes, and public ip address usage. To further minimize costs, you may scale to 0, or destroy the entire infrastucture when it is not in use. The process for a full rebuild is only a few minutes.

**What you get in each environment:

- Virtual Machine Scale Set
- Network Security Groups + firewall rules
- Container Registry
- Key Vault
- S3 compatible Storage Account
- IAM/RBAC for service accounts and users
- Public Ip addresses
- Pre-configured SSH credentials
- Cloud-init pre-provisioning


## Usage

1. Create an Azure Account and subscription. Record your UserID.

2. Run az login from the cli

3. Create a Service Principle

```bash
SUBSCRIPTION=$(az account show --query id --output tsv)
SP_NAME="myserviceaccount"

az ad sp create-for-rbac --sdk-auth \
  --display-name="${SP_NAME}" \
  --role="Owner" \
  --scopes="/subscriptions/$SUBSCRIPTION"
```

3. save the output

```json
{
  "clientId": "",
  "clientSecret": "",
  "subscriptionId": "",
  "tenantId": "",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

4. Create the Terraform State's Resource Group, Bucket, and Container

```bash
export SUBSCRIPTION=$(az account show --query id --output tsv)
export KIND="StorageV2"
export LOCATION="westeurope"
export RG_NAME="terraform-state"
export STORAGE_NAME="jumphoststate"
export STORAGE_SKU="Standard_RAGRS"
export CONTAINER_NAME="state"

az group create \
  -l="${LOCATION}" \
  -n="${RG_NAME}"

az storage account create \
  --name "${STORAGE_NAME}" \
  --resource-group "${RG_NAME}" \
  --location "${LOCATION}" \
  --sku "${STORAGE_SKU}" --kind "${KIND}"

az storage account encryption-scope create \
  --account-name "${STORAGE_NAME}"  \
  --key-source "Microsoft.Storage" --name "tfencryption" \
  --resource-group "${RG_NAME}" \
  --subscription "${SUBSCRIPTION}"

az storage container create \
    --name "${CONTAINER_NAME}" \
    --account-name "${STORAGE_NAME}" \
    --resource-group "${RG_NAME}" \
    --default-encryption-scope "tfencryption" \
    --prevent-encryption-scope-override "true" --auth-mode "login" \
    --fail-on-exist \
    --public-access "off"
```

5. Update the providers.tf file with the bucket data

6. update main.tf with subscription and tenant ids

5. run terraform init

```bash
docker pull hashicorp/terraform:latest && \
docker run --platform linux/amd64 -it \
 -e ARM_CLIENT_ID='' \
 -e ARM_CLIENT_SECRET='' \
 -e ARM_SUBSCRIPTION_ID='' \
 -e ARM_TENANT_ID='' \
 -v $(pwd):/workspace \
 -w /workspace \
 hashicorp/terraform:latest init
```

6. Import bucket and resource group into terraform:

```bash
STATE_RG_ID=$(az group list \
--query "[?name=='$RG_NAME'].id" \
--output tsv)

STATE_BUCKET_ID=$(az storage account list \
--resource-group $RG_NAME \
--query "[*].id" \
--output tsv)

docker pull hashicorp/terraform:latest && \
docker run --platform linux/amd64 -it \
  -e ARM_CLIENT_ID='' \
  -e ARM_CLIENT_SECRET='' \
  -e ARM_SUBSCRIPTION_ID='' \
  -e ARM_TENANT_ID='' \
  -v $(pwd):/workspace \
  -w /workspace \
  hashicorp/terraform:latest import azurerm_resource_group.state_rg $STATE_RG_ID

docker pull hashicorp/terraform:latest && \
docker run --platform linux/amd64 -it \
  -e ARM_CLIENT_ID='' \
  -e ARM_CLIENT_SECRET='' \
  -e ARM_SUBSCRIPTION_ID='' \
  -e ARM_TENANT_ID='' \
  -v $(pwd):/workspace \
  -w /workspace \
  hashicorp/terraform:latest import azurerm_storage_account.state_bucket $STATE_BUCKET_ID

```

7. Run terraform apply

```bash
docker pull hashicorp/terraform:latest && \
docker run --platform linux/amd64 -it \
  -e ARM_CLIENT_ID='' \
  -e ARM_CLIENT_SECRET='' \
  -e ARM_SUBSCRIPTION_ID='' \
  -e ARM_TENANT_ID='' \
  -v $(pwd):/workspace \
  -w /workspace \
  hashicorp/terraform:latest apply
```

8. Tear down VM scale set

```bash
docker pull hashicorp/terraform:latest && \
docker run --platform linux/amd64 -it \
  -e ARM_CLIENT_ID='' \
  -e ARM_CLIENT_SECRET='' \
  -e ARM_SUBSCRIPTION_ID='' \
  -e ARM_TENANT_ID='' \
  -v $(pwd):/workspace \
  -w /workspace \
  hashicorp/terraform:latest destroy --target=module.virtual-machine-scale-set -auto-approve
```

9. Tear Down base resources

```bash
docker run --platform linux/amd64 -it \
  -e ARM_CLIENT_ID='' \
  -e ARM_CLIENT_SECRET='' \
  -e ARM_SUBSCRIPTION_ID='' \
  -e ARM_TENANT_ID='' \
  -v $(pwd):/workspace \
  -w /workspace \
  hashicorp/terraform:latest destroy --target=module.environment-base -auto-approve 
```

