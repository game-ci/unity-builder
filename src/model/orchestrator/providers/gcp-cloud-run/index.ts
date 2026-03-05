/**
 * Google Cloud Run Jobs Provider (Experimental)
 *
 * Executes Unity builds as Cloud Run Jobs with configurable storage backends.
 *
 * Storage types:
 *   - gcs-fuse:   Mount a GCS bucket as a POSIX filesystem via GCS FUSE sidecar.
 *                  Unlimited size, best for large sequential reads/writes.
 *                  Requires: gcpBucket
 *   - gcs-copy:   Copy artifacts in/out of GCS before/after the build via gsutil.
 *                  No mount overhead, simpler, works everywhere.
 *                  Requires: gcpBucket
 *   - nfs:        Mount a Filestore NFS share. True POSIX semantics, good random I/O,
 *                  up to 100 TiB. Best for Library caching (many small random reads).
 *                  Requires: gcpFilestoreIp, gcpFilestoreShare
 *   - in-memory:  tmpfs volume (emptyDir). Fastest I/O but volatile and limited to 32 GiB.
 *                  Good for scratch/temp space during builds.
 *
 * Prerequisites:
 *   - Google Cloud SDK authenticated (GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
 *   - Cloud Run Jobs API enabled
 *   - Service account with roles: Cloud Run Admin, Storage Admin, Logs Viewer
 *
 * @experimental This provider is experimental. APIs and behavior may change.
 */

import { ProviderInterface } from '../provider-interface';
import BuildParameters from '../../../build-parameters';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import { Input } from '../../..';
import ResourceTracking from '../../services/core/resource-tracking';

type GcpStorageType = 'gcs-fuse' | 'gcs-copy' | 'nfs' | 'in-memory';

class GcpCloudRunProvider implements ProviderInterface {
  private readonly project: string;
  private readonly region: string;
  private readonly storageType: GcpStorageType;
  private readonly bucket: string;
  private readonly filestoreIp: string;
  private readonly filestoreShare: string;
  private readonly machineType: string;
  private readonly diskSizeGb: number;
  private readonly serviceAccount: string;
  private readonly vpcConnector: string;
  private buildParameters: BuildParameters;

  constructor(buildParameters: BuildParameters) {
    this.buildParameters = buildParameters;
    this.project = buildParameters.gcpProject || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';
    this.region = buildParameters.gcpRegion || Input.region || 'us-central1';
    this.storageType = (buildParameters.gcpStorageType || 'gcs-fuse') as GcpStorageType;
    this.bucket = buildParameters.gcpBucket || '';
    this.filestoreIp = buildParameters.gcpFilestoreIp || '';
    this.filestoreShare = buildParameters.gcpFilestoreShare || '/share1';
    this.machineType = buildParameters.gcpMachineType || 'e2-standard-4';
    this.diskSizeGb = Number.parseInt(buildParameters.gcpDiskSizeGb || '100', 10);
    this.serviceAccount = buildParameters.gcpServiceAccount || '';
    this.vpcConnector = buildParameters.gcpVpcConnector || '';

    OrchestratorLogger.log('[GCP Cloud Run] Provider initialized (EXPERIMENTAL)');
    OrchestratorLogger.log(`[GCP Cloud Run] Project: ${this.project || '(auto-detect)'}`);
    OrchestratorLogger.log(`[GCP Cloud Run] Region: ${this.region}`);
    OrchestratorLogger.log(`[GCP Cloud Run] Storage: ${this.storageType}`);

    this.validateStorageConfig();
  }

  private validateStorageConfig(): void {
    switch (this.storageType) {
      case 'gcs-fuse':
      case 'gcs-copy':
        if (!this.bucket) {
          OrchestratorLogger.logWarning(
            `[GCP Cloud Run] Storage type '${this.storageType}' requires gcpBucket to be set.`,
          );
        } else {
          OrchestratorLogger.log(`[GCP Cloud Run] Bucket: gs://${this.bucket}`);
        }
        break;
      case 'nfs':
        if (!this.filestoreIp) {
          OrchestratorLogger.logWarning('[GCP Cloud Run] Storage type "nfs" requires gcpFilestoreIp to be set.');
        } else {
          OrchestratorLogger.log(`[GCP Cloud Run] Filestore: ${this.filestoreIp}:${this.filestoreShare}`);
        }
        if (!this.vpcConnector) {
          OrchestratorLogger.logWarning(
            '[GCP Cloud Run] NFS storage usually requires gcpVpcConnector for private network access to Filestore.',
          );
        }
        break;
      case 'in-memory':
        OrchestratorLogger.log(`[GCP Cloud Run] In-memory volume: ${Math.min(this.diskSizeGb, 32)} GiB (max 32)`);
        break;
      default:
        OrchestratorLogger.logWarning(
          `[GCP Cloud Run] Unknown storage type '${this.storageType}'. Valid: gcs-fuse, gcs-copy, nfs, in-memory`,
        );
    }

    if (!this.project) {
      OrchestratorLogger.logWarning(
        '[GCP Cloud Run] No project specified. Set gcpProject input or GOOGLE_CLOUD_PROJECT env var.',
      );
    }
  }

  async setupWorkflow(
    buildGuid: string,
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    OrchestratorLogger.log(`[GCP Cloud Run] Setting up workflow for build ${buildGuid}`);
    ResourceTracking.logAllocationSummary('gcp-cloud-run setup');

    // Verify gcloud CLI is available
    try {
      await OrchestratorSystem.Run('gcloud --version', false, true);
      OrchestratorLogger.log('[GCP Cloud Run] gcloud CLI detected');
    } catch {
      throw new Error(
        '[GCP Cloud Run] gcloud CLI not found. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install',
      );
    }

    // Verify Cloud Run Jobs API is enabled
    try {
      const projectFlag = this.project ? `--project=${this.project}` : '';
      await OrchestratorSystem.Run(
        `gcloud services list --enabled --filter="name:run.googleapis.com" ${projectFlag} --format="value(name)"`,
        false,
        true,
      );
    } catch {
      OrchestratorLogger.logWarning(
        '[GCP Cloud Run] Could not verify Cloud Run API status. Ensure run.googleapis.com is enabled.',
      );
    }

    // Storage-specific setup
    if ((this.storageType === 'gcs-fuse' || this.storageType === 'gcs-copy') && this.bucket) {
      await this.ensureBucketExists();
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await OrchestratorSystem.Run(
        `gcloud storage buckets describe gs://${this.bucket} --format="value(name)"`,
        false,
        true,
      );
      OrchestratorLogger.log(`[GCP Cloud Run] Bucket gs://${this.bucket} exists`);
    } catch {
      OrchestratorLogger.log(`[GCP Cloud Run] Creating bucket gs://${this.bucket}`);
      const projectFlag = this.project ? `--project=${this.project}` : '';
      await OrchestratorSystem.Run(
        `gcloud storage buckets create gs://${this.bucket} --location=${this.region} ${projectFlag}`,
      );
    }
  }

  private buildVolumeFlags(mountdir: string): { volumeFlags: string; mountFlags: string } {
    switch (this.storageType) {
      case 'gcs-fuse':
        if (!this.bucket) return { volumeFlags: '', mountFlags: '' };
        return {
          volumeFlags: `--add-volume=name=gcs-fuse,type=cloud-storage,bucket=${this.bucket}`,
          mountFlags: `--add-volume-mount=volume=gcs-fuse,mount-path=${mountdir}`,
        };

      case 'nfs':
        if (!this.filestoreIp) return { volumeFlags: '', mountFlags: '' };
        return {
          volumeFlags: `--add-volume=name=nfs-vol,type=nfs,location=${this.filestoreIp}:${this.filestoreShare}`,
          mountFlags: `--add-volume-mount=volume=nfs-vol,mount-path=${mountdir}`,
        };

      case 'in-memory': {
        const sizeGib = Math.min(this.diskSizeGb, 32);
        return {
          volumeFlags: `--add-volume=name=tmpfs-vol,type=in-memory,size-limit=${sizeGib}Gi`,
          mountFlags: `--add-volume-mount=volume=tmpfs-vol,mount-path=${mountdir}`,
        };
      }

      case 'gcs-copy':
        // No volume mount — artifacts are copied in/out via gsutil commands
        return { volumeFlags: '', mountFlags: '' };

      default:
        return { volumeFlags: '', mountFlags: '' };
    }
  }

  private async copyArtifactsIn(mountdir: string): Promise<void> {
    if (this.storageType !== 'gcs-copy' || !this.bucket) return;
    OrchestratorLogger.log(`[GCP Cloud Run] Copying artifacts from gs://${this.bucket} to ${mountdir}`);
    try {
      await OrchestratorSystem.Run(`gcloud storage cp -r "gs://${this.bucket}/*" "${mountdir}/" || true`, false, true);
    } catch {
      OrchestratorLogger.log('[GCP Cloud Run] No existing artifacts to restore (bucket may be empty)');
    }
  }

  private async copyArtifactsOut(mountdir: string): Promise<void> {
    if (this.storageType !== 'gcs-copy' || !this.bucket) return;
    OrchestratorLogger.log(`[GCP Cloud Run] Uploading artifacts from ${mountdir} to gs://${this.bucket}`);
    await OrchestratorSystem.Run(`gcloud storage cp -r "${mountdir}/*" "gs://${this.bucket}/"`, false, true);
  }

  async runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    OrchestratorLogger.log(`[GCP Cloud Run] Running task for build ${buildGuid}`);
    ResourceTracking.logAllocationSummary('gcp-cloud-run task');

    const jobName = `unity-build-${buildGuid}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 63);
    const projectFlag = this.project ? `--project=${this.project}` : '';

    // Build environment variable flags
    const envFlags = environment
      .map((env) => `${env.name}=${env.value}`)
      .concat(secrets.map((s) => `${s.EnvironmentVariable}=${s.ParameterValue}`));
    const envString = envFlags.length > 0 ? `--set-env-vars="${envFlags.join(',')}"` : '';

    // Build storage volume flags
    const { volumeFlags, mountFlags } = this.buildVolumeFlags(mountdir);

    // For gcs-copy, wrap the user command with copy-in/copy-out steps
    let effectiveCommands = commands;
    if (this.storageType === 'gcs-copy' && this.bucket && commands) {
      effectiveCommands = [
        `gcloud storage cp -r "gs://${this.bucket}/*" "${mountdir}/" 2>/dev/null || true`,
        commands,
        `gcloud storage cp -r "${mountdir}/*" "gs://${this.bucket}/"`,
      ].join(' && ');
    }

    const saFlag = this.serviceAccount ? `--service-account=${this.serviceAccount}` : '';
    const vpcFlag = this.vpcConnector ? `--vpc-connector=${this.vpcConnector}` : '';

    // Create the Cloud Run Job
    const createCmd = [
      'gcloud run jobs create',
      jobName,
      `--image=${image}`,
      `--region=${this.region}`,
      '--task-timeout=86400s',
      '--max-retries=0',
      '--cpu=4',
      '--memory=16Gi',
      volumeFlags,
      mountFlags,
      envString,
      saFlag,
      vpcFlag,
      projectFlag,
      '--format=json',
      '--quiet',
    ]
      .filter(Boolean)
      .join(' ');

    try {
      await OrchestratorSystem.Run(createCmd);
      OrchestratorLogger.log(`[GCP Cloud Run] Job ${jobName} created`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        OrchestratorLogger.log(`[GCP Cloud Run] Job ${jobName} already exists, updating...`);
        const updateCmd = createCmd.replace('jobs create', 'jobs update');
        await OrchestratorSystem.Run(updateCmd);
      } else {
        throw error;
      }
    }

    // Override the command if provided
    if (effectiveCommands) {
      const updateCmd = [
        'gcloud run jobs update',
        jobName,
        `--region=${this.region}`,
        '--command="/bin/sh"',
        `--args="-c,${effectiveCommands}"`,
        projectFlag,
        '--quiet',
      ]
        .filter(Boolean)
        .join(' ');

      await OrchestratorSystem.Run(updateCmd);
    }

    // Execute the job
    OrchestratorLogger.log(`[GCP Cloud Run] Executing job ${jobName} (storage: ${this.storageType})...`);
    const executeCmd = [
      'gcloud run jobs execute',
      jobName,
      `--region=${this.region}`,
      projectFlag,
      '--wait',
      '--format=json',
      '--quiet',
    ]
      .filter(Boolean)
      .join(' ');

    let output = '';
    try {
      output = await OrchestratorSystem.Run(executeCmd);
      OrchestratorLogger.log('[GCP Cloud Run] Job execution completed');
    } catch (error: any) {
      await this.streamJobLogs(jobName);
      throw new Error(`[GCP Cloud Run] Job execution failed: ${error.message}`);
    }

    await this.streamJobLogs(jobName);
    return output;
  }

  private async streamJobLogs(jobName: string): Promise<void> {
    const projectFlag = this.project ? `--project=${this.project}` : '';
    try {
      const logs = await OrchestratorSystem.Run(
        `gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=${jobName}" ${projectFlag} --limit=1000 --format="value(textPayload)" --order=asc`,
        false,
        true,
      );
      if (logs) {
        for (const line of logs.split('\n')) {
          if (line.trim()) {
            OrchestratorLogger.log(`[Build] ${line}`);
          }
        }
      }
    } catch {
      OrchestratorLogger.logWarning('[GCP Cloud Run] Could not retrieve job logs');
    }
  }

  async cleanupWorkflow(
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    OrchestratorLogger.log('[GCP Cloud Run] Cleaning up workflow');
  }

  async garbageCollect(
    filter: string,
    previewOnly: boolean,
    olderThan: Number,
    fullCache: boolean,
    baseDependencies: boolean,
  ): Promise<string> {
    OrchestratorLogger.log('[GCP Cloud Run] Garbage collecting old jobs');
    const projectFlag = this.project ? `--project=${this.project}` : '';

    try {
      const jobsJson = await OrchestratorSystem.Run(
        `gcloud run jobs list --region=${this.region} ${projectFlag} --filter="metadata.name~unity-build-" --format="json(metadata.name,metadata.creationTimestamp)"`,
        false,
        true,
      );

      const jobs = JSON.parse(jobsJson || '[]');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - Number(olderThan));

      let deletedCount = 0;
      for (const job of jobs) {
        const createdAt = new Date(job.metadata?.creationTimestamp || 0);
        if (createdAt < cutoffDate) {
          const name = job.metadata?.name;
          if (previewOnly) {
            OrchestratorLogger.log(`[GCP Cloud Run] Would delete: ${name}`);
          } else {
            await OrchestratorSystem.Run(
              `gcloud run jobs delete ${name} --region=${this.region} ${projectFlag} --quiet`,
            );
            deletedCount++;
          }
        }
      }

      return `Garbage collected ${deletedCount} Cloud Run jobs`;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[GCP Cloud Run] Garbage collection failed: ${error.message}`);
      return '';
    }
  }

  async listResources(): Promise<ProviderResource[]> {
    const projectFlag = this.project ? `--project=${this.project}` : '';
    try {
      const jobsJson = await OrchestratorSystem.Run(
        `gcloud run jobs list --region=${this.region} ${projectFlag} --filter="metadata.name~unity-build-" --format="json(metadata.name)"`,
        false,
        true,
      );

      const jobs = JSON.parse(jobsJson || '[]');
      return jobs.map((job: any) => ({ Name: job.metadata?.name || '' }));
    } catch {
      return [];
    }
  }

  listWorkflow(): Promise<ProviderWorkflow[]> {
    throw new Error('[GCP Cloud Run] listWorkflow not implemented for this experimental provider');
  }

  async watchWorkflow(): Promise<string> {
    throw new Error('[GCP Cloud Run] watchWorkflow not implemented for this experimental provider');
  }
}

export default GcpCloudRunProvider;
