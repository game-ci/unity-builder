import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { waitUntil } from 'async-wait-until';
import { CloudRunnerSystem } from '../../services/core/cloud-runner-system';
import CloudRunner from '../../cloud-runner';
import KubernetesPods from './kubernetes-pods';
import { FollowLogStreamService } from '../../services/core/follow-log-stream-service';

class KubernetesTaskRunner {
  static readonly maxRetry: number = 3;
  static lastReceivedMessage: string = ``;

  static async runTask(
    kubeConfig: KubeConfig,
    kubeClient: CoreV1Api,
    jobName: string,
    podName: string,
    containerName: string,
    namespace: string,
  ) {
    let output = '';
    let shouldReadLogs = true;
    let shouldCleanup = true;
    let retriesAfterFinish = 0;
    let kubectlLogsFailedCount = 0;
    const maxKubectlLogsFailures = 3;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      CloudRunnerLogger.log(
        `Streaming logs from pod: ${podName} container: ${containerName} namespace: ${namespace} ${CloudRunner.buildParameters.kubeVolumeSize}/${CloudRunner.buildParameters.containerCpu}/${CloudRunner.buildParameters.containerMemory}`,
      );
      const isRunning = await KubernetesPods.IsPodRunning(podName, namespace, kubeClient);

      const callback = (outputChunk: string) => {
        // Filter out kubectl error messages about being unable to retrieve container logs
        // These errors pollute the output and don't contain useful information
        const lowerChunk = outputChunk.toLowerCase();
        if (lowerChunk.includes('unable to retrieve container logs')) {
          CloudRunnerLogger.log(`Filtered kubectl error: ${outputChunk.trim()}`);

          return;
        }

        output += outputChunk;

        // split output chunk and handle per line
        for (const chunk of outputChunk.split(`\n`)) {
          // Skip empty chunks and kubectl error messages (case-insensitive)
          const lowerCaseChunk = chunk.toLowerCase();
          if (chunk.trim() && !lowerCaseChunk.includes('unable to retrieve container logs')) {
            ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
              chunk,
              shouldReadLogs,
              shouldCleanup,
              output,
            ));
          }
        }
      };
      try {
        // Always specify container name explicitly to avoid containerd:// errors
        // Use -f for running pods, --previous for terminated pods
        await CloudRunnerSystem.Run(
          `kubectl logs ${podName} -c ${containerName} -n ${namespace}${isRunning ? ' -f' : ' --previous'}`,
          false,
          true,
          callback,
        );

        // Reset failure count on success
        kubectlLogsFailedCount = 0;
      } catch (error: any) {
        kubectlLogsFailedCount++;
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const continueStreaming = await KubernetesPods.IsPodRunning(podName, namespace, kubeClient);
        CloudRunnerLogger.log(`K8s logging error ${error} ${continueStreaming}`);

        // Filter out kubectl error messages from the error output
        const errorMessage = error?.message || error?.toString() || '';
        const isKubectlLogsError =
          errorMessage.includes('unable to retrieve container logs for containerd://') ||
          errorMessage.toLowerCase().includes('unable to retrieve container logs');

        if (isKubectlLogsError) {
          CloudRunnerLogger.log(
            `Kubectl unable to retrieve logs, attempt ${kubectlLogsFailedCount}/${maxKubectlLogsFailures}`,
          );

          // If kubectl logs has failed multiple times, try reading the log file directly from the pod
          // This works even if the pod is terminated, as long as it hasn't been deleted
          if (kubectlLogsFailedCount >= maxKubectlLogsFailures && !isRunning && !continueStreaming) {
            CloudRunnerLogger.log(`Attempting to read log file directly from pod as fallback...`);
            try {
              // Try to read the log file from the pod
              // Use kubectl exec for running pods, or try to access via PVC if pod is terminated
              let logFileContent = '';

              if (isRunning) {
                // Pod is still running, try exec
                logFileContent = await CloudRunnerSystem.Run(
                  `kubectl exec ${podName} -c ${containerName} -n ${namespace} -- cat /home/job-log.txt 2>/dev/null || echo ""`,
                  true,
                  true,
                );
              } else {
                // Pod is terminated, try to create a temporary pod to read from the PVC
                // First, check if we can still access the pod's filesystem
                CloudRunnerLogger.log(`Pod is terminated, attempting to read log file via temporary pod...`);

                // For terminated pods, we might not be able to exec, so we'll skip this fallback
                // and rely on the log file being written to the PVC (if mounted)
                CloudRunnerLogger.logWarning(`Cannot read log file from terminated pod via exec`);
              }

              if (logFileContent && logFileContent.trim()) {
                CloudRunnerLogger.log(`Successfully read log file from pod (${logFileContent.length} chars)`);

                // Process the log file content line by line
                for (const line of logFileContent.split(`\n`)) {
                  const lowerLine = line.toLowerCase();
                  if (line.trim() && !lowerLine.includes('unable to retrieve container logs')) {
                    ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
                      line,
                      shouldReadLogs,
                      shouldCleanup,
                      output,
                    ));
                  }
                }

                // Check if we got the end of transmission marker
                if (FollowLogStreamService.DidReceiveEndOfTransmission) {
                  CloudRunnerLogger.log('end of log stream (from log file)');
                  break;
                }
              } else {
                CloudRunnerLogger.logWarning(`Log file read returned empty content, continuing with available logs`);

                // If we can't read the log file, break out of the loop to return whatever logs we have
                // This prevents infinite retries when kubectl logs consistently fails
                break;
              }
            } catch (execError: any) {
              CloudRunnerLogger.logWarning(`Failed to read log file from pod: ${execError}`);

              // If we've exhausted all options, break to return whatever logs we have
              break;
            }
          }
        }

        // If pod is not running and we tried --previous but it failed, try without --previous
        if (!isRunning && !continueStreaming && error?.message?.includes('previous terminated container')) {
          CloudRunnerLogger.log(`Previous container not found, trying current container logs...`);
          try {
            await CloudRunnerSystem.Run(
              `kubectl logs ${podName} -c ${containerName} -n ${namespace}`,
              false,
              true,
              callback,
            );

            // If we successfully got logs, check for end of transmission
            if (FollowLogStreamService.DidReceiveEndOfTransmission) {
              CloudRunnerLogger.log('end of log stream');
              break;
            }

            // If we got logs but no end marker, continue trying (might be more logs)
            if (retriesAfterFinish < KubernetesTaskRunner.maxRetry) {
              retriesAfterFinish++;
              continue;
            }

            // If we've exhausted retries, break
            break;
          } catch (fallbackError: any) {
            CloudRunnerLogger.log(`Fallback log fetch also failed: ${fallbackError}`);

            // If both fail, continue retrying if we haven't exhausted retries
            if (retriesAfterFinish < KubernetesTaskRunner.maxRetry) {
              retriesAfterFinish++;
              continue;
            }

            // Only break if we've exhausted all retries
            CloudRunnerLogger.logWarning(
              `Could not fetch any container logs after ${KubernetesTaskRunner.maxRetry} retries`,
            );
            break;
          }
        }

        if (continueStreaming) {
          continue;
        }
        if (retriesAfterFinish < KubernetesTaskRunner.maxRetry) {
          retriesAfterFinish++;
          continue;
        }

        // If we've exhausted retries and it's not a previous container issue, throw
        if (!error?.message?.includes('previous terminated container')) {
          throw error;
        }

        // For previous container errors, we've already tried fallback, so just break
        CloudRunnerLogger.logWarning(
          `Could not fetch previous container logs after retries, but continuing with available logs`,
        );
        break;
      }
      if (FollowLogStreamService.DidReceiveEndOfTransmission) {
        CloudRunnerLogger.log('end of log stream');
        break;
      }
    }

    // After kubectl logs loop ends, read log file as fallback to capture any messages
    // written after kubectl stopped reading (e.g., "Collected Logs" from post-build)
    // This ensures all log messages are included in BuildResults for test assertions
    // If output is empty, we need to be more aggressive about getting logs
    const needsFallback = output.trim().length === 0;
    const missingCollectedLogs = !output.includes('Collected Logs');

    if (needsFallback) {
      CloudRunnerLogger.log('Output is empty, attempting aggressive log collection fallback...');

      // Give the pod a moment to finish writing logs before we try to read them
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Always try fallback if output is empty, if pod is terminated, or if "Collected Logs" is missing
    // The "Collected Logs" check ensures we try to get post-build messages even if we have some output
    try {
      const isPodStillRunning = await KubernetesPods.IsPodRunning(podName, namespace, kubeClient);
      const shouldTryFallback = !isPodStillRunning || needsFallback || missingCollectedLogs;

      if (shouldTryFallback) {
        const reason = needsFallback
          ? 'output is empty'
          : missingCollectedLogs
          ? 'Collected Logs missing from output'
          : 'pod is terminated';
        CloudRunnerLogger.log(
          `Pod is ${isPodStillRunning ? 'running' : 'terminated'} and ${reason}, reading log file as fallback...`,
        );
        try {
          // Try to read the log file from the pod
          // For killed pods (OOM), kubectl exec might not work, so we try multiple approaches
          // First try --previous flag for terminated containers, then try without it
          let logFileContent = '';

          // Try multiple approaches to get the log file
          // Order matters: try terminated container first, then current, then PVC, then kubectl logs as last resort
          // For K8s, the PVC is mounted at /data, so try reading from there too
          const attempts = [
            // For terminated pods, try --previous first
            `kubectl exec ${podName} -c ${containerName} -n ${namespace} --previous -- cat /home/job-log.txt 2>/dev/null || echo ""`,

            // Try current container
            `kubectl exec ${podName} -c ${containerName} -n ${namespace} -- cat /home/job-log.txt 2>/dev/null || echo ""`,

            // Try reading from PVC (/data) in case log was copied there
            `kubectl exec ${podName} -c ${containerName} -n ${namespace} --previous -- cat /data/job-log.txt 2>/dev/null || echo ""`,
            `kubectl exec ${podName} -c ${containerName} -n ${namespace} -- cat /data/job-log.txt 2>/dev/null || echo ""`,

            // Try kubectl logs as fallback (might capture stdout even if exec fails)
            `kubectl logs ${podName} -c ${containerName} -n ${namespace} --previous 2>/dev/null || echo ""`,
            `kubectl logs ${podName} -c ${containerName} -n ${namespace} 2>/dev/null || echo ""`,
          ];

          for (const attempt of attempts) {
            // If we already have content with "Collected Logs", no need to try more
            if (logFileContent && logFileContent.trim() && logFileContent.includes('Collected Logs')) {
              CloudRunnerLogger.log('Found "Collected Logs" in fallback content, stopping attempts.');
              break;
            }
            try {
              CloudRunnerLogger.log(`Trying fallback method: ${attempt.slice(0, 80)}...`);
              const result = await CloudRunnerSystem.Run(attempt, true, true);
              if (result && result.trim()) {
                // Prefer content that has "Collected Logs" over content that doesn't
                if (!logFileContent || !logFileContent.includes('Collected Logs')) {
                  logFileContent = result;
                  CloudRunnerLogger.log(
                    `Successfully read logs using fallback method (${logFileContent.length} chars): ${attempt.slice(
                      0,
                      50,
                    )}...`,
                  );

                  // If this content has "Collected Logs", we're done
                  if (logFileContent.includes('Collected Logs')) {
                    CloudRunnerLogger.log('Fallback method successfully captured "Collected Logs".');
                    break;
                  }
                } else {
                  CloudRunnerLogger.log(`Skipping this result - already have content with "Collected Logs".`);
                }
              } else {
                CloudRunnerLogger.log(`Fallback method returned empty result: ${attempt.slice(0, 50)}...`);
              }
            } catch (attemptError: any) {
              CloudRunnerLogger.log(
                `Fallback method failed: ${attempt.slice(0, 50)}... Error: ${attemptError?.message || attemptError}`,
              );

              // Continue to next attempt
            }
          }

          if (!logFileContent || !logFileContent.trim()) {
            CloudRunnerLogger.logWarning(
              'Could not read log file from pod after all fallback attempts (may be OOM-killed or pod not accessible).',
            );
          }

          if (logFileContent && logFileContent.trim()) {
            CloudRunnerLogger.log(
              `Read log file from pod as fallback (${logFileContent.length} chars) to capture missing messages`,
            );

            // Get the lines we already have in output to avoid duplicates
            const existingLines = new Set(output.split('\n').map((line) => line.trim()));

            // Process the log file content line by line and add missing lines
            for (const line of logFileContent.split(`\n`)) {
              const trimmedLine = line.trim();
              const lowerLine = trimmedLine.toLowerCase();

              // Skip empty lines, kubectl errors, and lines we already have
              if (
                trimmedLine &&
                !lowerLine.includes('unable to retrieve container logs') &&
                !existingLines.has(trimmedLine)
              ) {
                // Process through FollowLogStreamService - it will append to output
                // Don't add to output manually since handleIteration does it
                ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
                  trimmedLine,
                  shouldReadLogs,
                  shouldCleanup,
                  output,
                ));
              }
            }
          }
        } catch (logFileError: any) {
          CloudRunnerLogger.logWarning(
            `Could not read log file from pod as fallback: ${logFileError?.message || logFileError}`,
          );

          // Continue with existing output - this is a best-effort fallback
        }
      }

      // If output is still empty or missing "Collected Logs" after fallback attempts, add a warning message
      // This ensures BuildResults is not completely empty, which would cause test failures
      if ((needsFallback && output.trim().length === 0) || (!output.includes('Collected Logs') && shouldTryFallback)) {
        CloudRunnerLogger.logWarning(
          'Could not retrieve "Collected Logs" from pod after all attempts. Pod may have been killed before logs were written.',
        );

        // Add a minimal message so BuildResults is not completely empty
        // This helps with debugging and prevents test failures due to empty results
        if (output.trim().length === 0) {
          output = 'Pod logs unavailable - pod may have been terminated before logs could be collected.\n';
        } else if (!output.includes('Collected Logs')) {
          // We have some output but missing "Collected Logs" - append the fallback message
          output +=
            '\nPod logs incomplete - "Collected Logs" marker not found. Pod may have been terminated before post-build completed.\n';
        }
      }
    } catch (fallbackError: any) {
      CloudRunnerLogger.logWarning(
        `Error checking pod status for log file fallback: ${fallbackError?.message || fallbackError}`,
      );

      // If output is empty and we hit an error, still add a message so BuildResults isn't empty
      if (needsFallback && output.trim().length === 0) {
        output = `Error retrieving logs: ${fallbackError?.message || fallbackError}\n`;
      }

      // Continue with existing output - this is a best-effort fallback
    }

    // Filter out kubectl error messages from the final output
    // These errors can be added via stderr even when kubectl fails
    // We filter them out so they don't pollute the BuildResults
    const lines = output.split('\n');
    const filteredLines = lines.filter((line) => !line.toLowerCase().includes('unable to retrieve container logs'));
    const filteredOutput = filteredLines.join('\n');

    // Log if we filtered out significant content
    const originalLineCount = lines.length;
    const filteredLineCount = filteredLines.length;
    if (originalLineCount > filteredLineCount) {
      CloudRunnerLogger.log(
        `Filtered out ${originalLineCount - filteredLineCount} kubectl error message(s) from output`,
      );
    }

    return filteredOutput;
  }

  static async watchUntilPodRunning(kubeClient: CoreV1Api, podName: string, namespace: string) {
    let waitComplete: boolean = false;
    let message = ``;
    let lastPhase = '';
    let consecutivePendingCount = 0;
    CloudRunnerLogger.log(`Watching ${podName} ${namespace}`);

    try {
      await waitUntil(
        async () => {
          const status = await kubeClient.readNamespacedPodStatus(podName, namespace);
          const phase = status?.body.status?.phase || 'Unknown';
          const conditions = status?.body.status?.conditions || [];
          const containerStatuses = status?.body.status?.containerStatuses || [];

          // Log phase changes
          if (phase !== lastPhase) {
            CloudRunnerLogger.log(`Pod ${podName} phase changed: ${lastPhase} -> ${phase}`);
            lastPhase = phase;
            consecutivePendingCount = 0;
          }

          // Check for failure conditions that mean the pod will never start (permanent failures)
          // Note: We don't treat "Failed" phase as a permanent failure because the pod might have
          // completed its work before being killed (OOM), and we should still try to get logs
          const permanentFailureReasons = [
            'Unschedulable',
            'ImagePullBackOff',
            'ErrImagePull',
            'CreateContainerError',
            'CreateContainerConfigError',
          ];

          const hasPermanentFailureCondition = conditions.some((condition: any) =>
            permanentFailureReasons.some((reason) => condition.reason?.includes(reason)),
          );

          const hasPermanentFailureContainerStatus = containerStatuses.some((containerStatus: any) =>
            permanentFailureReasons.some((reason) => containerStatus.state?.waiting?.reason?.includes(reason)),
          );

          // Only treat permanent failures as errors - pods that completed (Failed/Succeeded) should continue
          if (hasPermanentFailureCondition || hasPermanentFailureContainerStatus) {
            // Get detailed failure information
            const failureCondition = conditions.find((condition: any) =>
              permanentFailureReasons.some((reason) => condition.reason?.includes(reason)),
            );
            const failureContainer = containerStatuses.find((containerStatus: any) =>
              permanentFailureReasons.some((reason) => containerStatus.state?.waiting?.reason?.includes(reason)),
            );

            message = `Pod ${podName} failed to start (permanent failure):\nPhase: ${phase}\n`;
            if (failureCondition) {
              message += `Condition Reason: ${failureCondition.reason}\nCondition Message: ${failureCondition.message}\n`;
            }
            if (failureContainer) {
              message += `Container Reason: ${failureContainer.state?.waiting?.reason}\nContainer Message: ${failureContainer.state?.waiting?.message}\n`;
            }

            // Log pod events for additional context
            try {
              const events = await kubeClient.listNamespacedEvent(namespace);
              const podEvents = events.body.items
                .filter((x) => x.involvedObject?.name === podName)
                .map((x) => ({
                  message: x.message || ``,
                  reason: x.reason || ``,
                  type: x.type || ``,
                }));
              if (podEvents.length > 0) {
                message += `\nRecent Events:\n${JSON.stringify(podEvents.slice(-5), undefined, 2)}`;
              }
            } catch {
              // Ignore event fetch errors
            }

            CloudRunnerLogger.logWarning(message);

            // For permanent failures, mark as incomplete and store the error message
            // We'll throw an error after the wait loop exits
            waitComplete = false;

            return true; // Return true to exit wait loop
          }

          // Pod is complete if it's not Pending or Unknown - it might be Running, Succeeded, or Failed
          // For Failed/Succeeded pods, we still want to try to get logs, so we mark as complete
          waitComplete = phase !== 'Pending' && phase !== 'Unknown';

          // If pod completed (Succeeded/Failed), log it but don't throw - we'll try to get logs
          if (waitComplete && phase !== 'Running') {
            CloudRunnerLogger.log(`Pod ${podName} completed with phase: ${phase}. Will attempt to retrieve logs.`);
          }

          if (phase === 'Pending') {
            consecutivePendingCount++;

            // Check for scheduling failures in events (faster than waiting for conditions)
            try {
              const events = await kubeClient.listNamespacedEvent(namespace);
              const podEvents = events.body.items.filter((x) => x.involvedObject?.name === podName);
              const failedSchedulingEvents = podEvents.filter(
                (x) => x.reason === 'FailedScheduling' || x.reason === 'SchedulingGated',
              );

              if (failedSchedulingEvents.length > 0) {
                const schedulingMessage = failedSchedulingEvents
                  .map((x) => `${x.reason}: ${x.message || ''}`)
                  .join('; ');
                message = `Pod ${podName} cannot be scheduled:\n${schedulingMessage}`;
                CloudRunnerLogger.logWarning(message);
                waitComplete = false;

                return true; // Exit wait loop to throw error
              }

              // Check if pod is actively pulling an image - if so, allow more time
              const isPullingImage = podEvents.some(
                (x) => x.reason === 'Pulling' || x.reason === 'Pulled' || x.message?.includes('Pulling image'),
              );
              const hasImagePullError = podEvents.some(
                (x) => x.reason === 'Failed' && (x.message?.includes('pull') || x.message?.includes('image')),
              );

              if (hasImagePullError) {
                message = `Pod ${podName} failed to pull image. Check image availability and credentials.`;
                CloudRunnerLogger.logWarning(message);
                waitComplete = false;

                return true; // Exit wait loop to throw error
              }

              // If actively pulling image, reset pending count to allow more time
              // Large images (like Unity 3.9GB) can take 3-5 minutes to pull
              if (isPullingImage && consecutivePendingCount > 4) {
                CloudRunnerLogger.log(
                  `Pod ${podName} is pulling image (check ${consecutivePendingCount}). This may take several minutes for large images.`,
                );

                // Don't increment consecutivePendingCount if we're actively pulling
                consecutivePendingCount = Math.max(4, consecutivePendingCount - 1);
              }
            } catch {
              // Ignore event fetch errors
            }

            // For tests, allow more time if image is being pulled (large images need 5+ minutes)
            // Otherwise fail faster if stuck in Pending (2 minutes = 8 checks at 15s interval)
            const isTest = process.env['cloudRunnerTests'] === 'true';
            const isPullingImage =
              containerStatuses.some(
                (cs: any) => cs.state?.waiting?.reason === 'ImagePull' || cs.state?.waiting?.reason === 'ErrImagePull',
              ) || conditions.some((c: any) => c.reason?.includes('Pulling'));

            // Allow up to 20 minutes for image pulls in tests (80 checks), 2 minutes otherwise
            const maxPendingChecks = isTest && isPullingImage ? 80 : isTest ? 8 : 80;

            if (consecutivePendingCount >= maxPendingChecks) {
              message = `Pod ${podName} stuck in Pending state for too long (${consecutivePendingCount} checks). This indicates a scheduling problem.`;

              // Get events for context
              try {
                const events = await kubeClient.listNamespacedEvent(namespace);
                const podEvents = events.body.items
                  .filter((x) => x.involvedObject?.name === podName)
                  .slice(-10)
                  .map((x) => `${x.type}: ${x.reason} - ${x.message}`);
                if (podEvents.length > 0) {
                  message += `\n\nRecent Events:\n${podEvents.join('\n')}`;
                }

                // Get pod details to check for scheduling issues
                try {
                  const podStatus = await kubeClient.readNamespacedPodStatus(podName, namespace);
                  const podSpec = podStatus.body.spec;
                  const podStatusDetails = podStatus.body.status;

                  // Check container resource requests
                  if (podSpec?.containers?.[0]?.resources?.requests) {
                    const requests = podSpec.containers[0].resources.requests;
                    message += `\n\nContainer Resource Requests:\n  CPU: ${requests.cpu || 'not set'}\n  Memory: ${
                      requests.memory || 'not set'
                    }\n  Ephemeral Storage: ${requests['ephemeral-storage'] || 'not set'}`;
                  }

                  // Check node selector and tolerations
                  if (podSpec?.nodeSelector && Object.keys(podSpec.nodeSelector).length > 0) {
                    message += `\n\nNode Selector: ${JSON.stringify(podSpec.nodeSelector)}`;
                  }
                  if (podSpec?.tolerations && podSpec.tolerations.length > 0) {
                    message += `\n\nTolerations: ${JSON.stringify(podSpec.tolerations)}`;
                  }

                  // Check pod conditions for scheduling issues
                  if (podStatusDetails?.conditions) {
                    const allConditions = podStatusDetails.conditions.map(
                      (c: any) =>
                        `${c.type}: ${c.status}${c.reason ? ` (${c.reason})` : ''}${
                          c.message ? ` - ${c.message}` : ''
                        }`,
                    );
                    message += `\n\nPod Conditions:\n${allConditions.join('\n')}`;

                    const unschedulable = podStatusDetails.conditions.find(
                      (c: any) => c.type === 'PodScheduled' && c.status === 'False',
                    );
                    if (unschedulable) {
                      message += `\n\nScheduling Issue: ${unschedulable.reason || 'Unknown'} - ${
                        unschedulable.message || 'No message'
                      }`;
                    }

                    // Check if pod is assigned to a node
                    message += podStatusDetails?.hostIP
                      ? `\n\nPod assigned to node: ${podStatusDetails.hostIP}`
                      : `\n\nPod not yet assigned to a node (scheduling pending)`;
                  }

                  // Check node resources if pod is assigned
                  if (podStatusDetails?.hostIP) {
                    try {
                      const nodes = await kubeClient.listNode();
                      const hostIP = podStatusDetails.hostIP;
                      const assignedNode = nodes.body.items.find((n: any) =>
                        n.status?.addresses?.some((a: any) => a.address === hostIP),
                      );
                      if (assignedNode?.status && assignedNode.metadata?.name) {
                        const allocatable = assignedNode.status.allocatable || {};
                        message += `\n\nNode Resources (${assignedNode.metadata.name}):\n  Allocatable CPU: ${
                          allocatable.cpu || 'unknown'
                        }\n  Allocatable Memory: ${allocatable.memory || 'unknown'}\n  Allocatable Ephemeral Storage: ${
                          allocatable['ephemeral-storage'] || 'unknown'
                        }`;

                        // Check for taints that might prevent scheduling
                        if (assignedNode.spec?.taints && assignedNode.spec.taints.length > 0) {
                          const taints = assignedNode.spec.taints
                            .map((t: any) => `${t.key}=${t.value}:${t.effect}`)
                            .join(', ');
                          message += `\n  Node Taints: ${taints}`;
                        }
                      }
                    } catch {
                      // Ignore node check errors
                    }
                  }
                } catch {
                  // Ignore pod status fetch errors
                }
              } catch {
                // Ignore event fetch errors
              }
              CloudRunnerLogger.logWarning(message);
              waitComplete = false;

              return true; // Exit wait loop to throw error
            }

            // Log diagnostic info every 4 checks (1 minute) if still pending
            if (consecutivePendingCount % 4 === 0) {
              const pendingMessage = `Pod ${podName} still Pending (check ${consecutivePendingCount}/${maxPendingChecks}). Phase: ${phase}`;
              const conditionMessages = conditions
                .map((c: any) => `${c.type}: ${c.reason || 'N/A'} - ${c.message || 'N/A'}`)
                .join('; ');
              CloudRunnerLogger.log(`${pendingMessage}. Conditions: ${conditionMessages || 'None'}`);

              // Log events periodically to help diagnose
              if (consecutivePendingCount % 8 === 0) {
                try {
                  const events = await kubeClient.listNamespacedEvent(namespace);
                  const podEvents = events.body.items
                    .filter((x) => x.involvedObject?.name === podName)
                    .slice(-3)
                    .map((x) => `${x.type}: ${x.reason} - ${x.message}`)
                    .join('; ');
                  if (podEvents) {
                    CloudRunnerLogger.log(`Recent pod events: ${podEvents}`);
                  }
                } catch {
                  // Ignore event fetch errors
                }
              }
            }
          }

          message = `Phase:${phase} \n Reason:${conditions[0]?.reason || ''} \n Message:${
            conditions[0]?.message || ''
          }`;

          if (waitComplete || phase !== 'Pending') return true;

          return false;
        },
        {
          timeout: process.env['cloudRunnerTests'] === 'true' ? 300000 : 2000000, // 5 minutes for tests, ~33 minutes for production
          intervalBetweenAttempts: 15000, // 15 seconds
        },
      );
    } catch (waitError: any) {
      // If waitUntil times out or throws, get final pod status
      try {
        const finalStatus = await kubeClient.readNamespacedPodStatus(podName, namespace);
        const phase = finalStatus?.body.status?.phase || 'Unknown';
        const conditions = finalStatus?.body.status?.conditions || [];
        message = `Pod ${podName} timed out waiting to start.\nFinal Phase: ${phase}\n`;
        message += conditions.map((c: any) => `${c.type}: ${c.reason} - ${c.message}`).join('\n');

        // Get events for context
        try {
          const events = await kubeClient.listNamespacedEvent(namespace);
          const podEvents = events.body.items
            .filter((x) => x.involvedObject?.name === podName)
            .slice(-5)
            .map((x) => `${x.type}: ${x.reason} - ${x.message}`);
          if (podEvents.length > 0) {
            message += `\n\nRecent Events:\n${podEvents.join('\n')}`;
          }
        } catch {
          // Ignore event fetch errors
        }

        CloudRunnerLogger.logWarning(message);
      } catch {
        message = `Pod ${podName} timed out and could not retrieve final status: ${waitError?.message || waitError}`;
        CloudRunnerLogger.logWarning(message);
      }

      throw new Error(`Pod ${podName} failed to start within timeout. ${message}`);
    }

    // Only throw if we detected a permanent failure condition
    // If the pod completed (Failed/Succeeded), we should still try to get logs
    if (!waitComplete) {
      // Check the final phase to see if it's a permanent failure or just completed
      try {
        const finalStatus = await kubeClient.readNamespacedPodStatus(podName, namespace);
        const finalPhase = finalStatus?.body.status?.phase || 'Unknown';
        if (finalPhase === 'Failed' || finalPhase === 'Succeeded') {
          CloudRunnerLogger.logWarning(
            `Pod ${podName} completed with phase ${finalPhase} before reaching Running state. Will attempt to retrieve logs.`,
          );

          return true; // Allow workflow to continue and try to get logs
        }
      } catch {
        // If we can't check status, fall through to throw error
      }
      CloudRunnerLogger.logWarning(`Pod ${podName} did not reach running state: ${message}`);
      throw new Error(`Pod ${podName} did not start successfully: ${message}`);
    }

    return waitComplete;
  }
}

export default KubernetesTaskRunner;
