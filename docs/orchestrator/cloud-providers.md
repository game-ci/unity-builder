# Cloud Providers (Experimental)

Two experimental cloud providers for running Unity builds on GCP and Azure serverless container infrastructure. Both support multiple storage backends.

> These providers are **experimental**. APIs and behavior may change between releases.

## GCP Cloud Run Jobs

`providerStrategy: gcp-cloud-run`

Runs Unity builds as [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs) — one-off container executions with configurable storage.

### Prerequisites

- Google Cloud SDK installed and authenticated (`gcloud auth login` or `GOOGLE_APPLICATION_CREDENTIALS`)
- Cloud Run Jobs API enabled (`gcloud services enable run.googleapis.com`)
- Service account with roles: Cloud Run Admin, Storage Admin, Logs Viewer

### Storage Types

Set `gcpStorageType` to control how the build accesses large files.

| Type | How it works | Best for | Size limit | Requires |
|------|-------------|----------|------------|----------|
| `gcs-fuse` (default) | Mounts a GCS bucket as a local filesystem via FUSE sidecar | Large sequential I/O, artifact storage | Unlimited | `gcpBucket` |
| `gcs-copy` | Copies artifacts in/out via `gsutil` before and after the build | Simple upload/download workflows | Unlimited | `gcpBucket` |
| `nfs` | Mounts a Filestore instance as an NFS share | Unity Library caching (many small random reads) | 100 TiB | `gcpFilestoreIp`, `gcpVpcConnector` |
| `in-memory` | tmpfs volume inside the container | Scratch/temp space during builds | 32 GiB | — |

### Trade-offs

- **gcs-fuse** has latency on small file I/O and eventual consistency edge cases, but handles very large files well and persists across builds.
- **gcs-copy** is simpler (no FUSE driver) but adds copy time before and after each build. Good when you only need artifact upload/download, not live filesystem access.
- **nfs** gives true POSIX semantics with good random I/O performance. Best choice when Unity reads many small files from the Library folder. Requires a Filestore instance and VPC connector.
- **in-memory** is the fastest option but volatile (data lost when the job ends) and capped at 32 GiB. Use for temporary build artifacts that don't need to persist.

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `gcpProject` | `$GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `gcpRegion` | `us-central1` | Cloud Run region |
| `gcpStorageType` | `gcs-fuse` | Storage backend (see above) |
| `gcpBucket` | — | GCS bucket name (for gcs-fuse, gcs-copy) |
| `gcpFilestoreIp` | — | Filestore IP address (for nfs) |
| `gcpFilestoreShare` | `/share1` | Filestore share name (for nfs) |
| `gcpMachineType` | `e2-standard-4` | Machine type |
| `gcpDiskSizeGb` | `100` | In-memory volume size (for in-memory, max 32) |
| `gcpServiceAccount` | — | Service account email |
| `gcpVpcConnector` | — | VPC connector (required for nfs) |

### Example

```yaml
# GCS FUSE — mount bucket as filesystem
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: gcp-cloud-run
    gcpProject: my-project
    gcpBucket: my-unity-builds
    targetPlatform: StandaloneLinux64

# NFS — Filestore for fast Library caching
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: gcp-cloud-run
    gcpProject: my-project
    gcpStorageType: nfs
    gcpFilestoreIp: 10.0.0.2
    gcpFilestoreShare: /share1
    gcpVpcConnector: my-connector
    targetPlatform: StandaloneLinux64

# Copy — simple artifact upload/download
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: gcp-cloud-run
    gcpProject: my-project
    gcpStorageType: gcs-copy
    gcpBucket: my-unity-builds
    targetPlatform: StandaloneLinux64
```

---

## Azure Container Instances

`providerStrategy: azure-aci`

Runs Unity builds as [Azure Container Instances](https://learn.microsoft.com/en-us/azure/container-instances/) — serverless containers with configurable storage.

### Prerequisites

- Azure CLI installed and authenticated (`az login` or service principal)
- A resource group (created automatically if it doesn't exist)
- Contributor role on the resource group

### Storage Types

Set `azureStorageType` to control how the build accesses large files.

| Type | How it works | Best for | Size limit | Requires |
|------|-------------|----------|------------|----------|
| `azure-files` (default) | Mounts an Azure File Share via SMB | General artifact storage, premium throughput | 100 TiB | `azureStorageAccount` |
| `blob-copy` | Copies artifacts in/out via `az storage blob` before and after the build | Simple upload/download workflows | Unlimited | `azureStorageAccount`, `azureBlobContainer` |
| `azure-files-nfs` | Mounts an Azure File Share via NFS 4.1 | Unity Library caching (true POSIX, no SMB lock overhead) | 100 TiB | `azureStorageAccount`, `azureSubnetId` |
| `in-memory` | emptyDir volume (tmpfs) | Scratch/temp space during builds | Container memory | — |

### Trade-offs

- **azure-files** is the simplest persistent option. SMB has some overhead from opportunistic locking but works out of the box. Auto-creates the storage account and file share if they don't exist.
- **blob-copy** avoids mount overhead entirely but adds copy time. Good when you only need artifact upload/download.
- **azure-files-nfs** eliminates SMB lock overhead for better random I/O with Unity Library files. Requires Premium FileStorage (auto-created) and VNet integration via `azureSubnetId`.
- **in-memory** is fastest but volatile and limited by container memory. Data is lost when the container stops.

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `azureResourceGroup` | `$AZURE_RESOURCE_GROUP` | Resource group name |
| `azureLocation` | `eastus` | Azure region |
| `azureStorageType` | `azure-files` | Storage backend (see above) |
| `azureStorageAccount` | `$AZURE_STORAGE_ACCOUNT` | Storage account name |
| `azureBlobContainer` | `unity-builds` | Blob container (for blob-copy) |
| `azureFileShareName` | `unity-builds` | File share name (for azure-files, azure-files-nfs) |
| `azureSubscriptionId` | `$AZURE_SUBSCRIPTION_ID` | Subscription ID |
| `azureCpu` | `4` | CPU cores (1-16) |
| `azureMemoryGb` | `16` | Memory in GB (1-16) |
| `azureDiskSizeGb` | `100` | File share quota in GB |
| `azureSubnetId` | — | Subnet ID for VNet integration (required for azure-files-nfs) |

### Example

```yaml
# Azure Files — SMB mount (default)
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: azure-aci
    azureResourceGroup: my-rg
    azureStorageAccount: myunitybuilds
    targetPlatform: StandaloneLinux64

# NFS — better POSIX performance
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: azure-aci
    azureResourceGroup: my-rg
    azureStorageType: azure-files-nfs
    azureStorageAccount: myunitybuilds
    azureSubnetId: /subscriptions/.../subnets/default
    targetPlatform: StandaloneLinux64

# Blob copy — simple artifact upload/download
- uses: game-ci/unity-builder@main
  with:
    providerStrategy: azure-aci
    azureResourceGroup: my-rg
    azureStorageType: blob-copy
    azureStorageAccount: myunitybuilds
    targetPlatform: StandaloneLinux64
```

## Related

- [Provider Plugins](provider-plugins.md) — CLI provider protocol, dynamic loading, provider interface
- [Build Services](build-services.md) — Submodule profiles, local caching, LFS agents, git hooks
