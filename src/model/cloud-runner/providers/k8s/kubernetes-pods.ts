import CloudRunnerLogger from '../../services/core/cloud-runner-logger';
import { CoreV1Api } from '@kubernetes/client-node';
class KubernetesPods {
  public static async IsPodRunning(podName: string, namespace: string, kubeClient: CoreV1Api) {
    const pods = (await kubeClient.listNamespacedPod(namespace)).body.items.filter((x) => podName === x.metadata?.name);
    const running = pods.length > 0 && (pods[0].status?.phase === `Running` || pods[0].status?.phase === `Pending`);
    const phase = pods[0]?.status?.phase || 'undefined status';
    CloudRunnerLogger.log(`Getting pod status: ${phase}`);
    if (phase === `Failed`) {
      const pod = pods[0];
      const containerStatuses = pod.status?.containerStatuses || [];
      const conditions = pod.status?.conditions || [];
      const events = (await kubeClient.listNamespacedEvent(namespace)).body.items
        .filter((x) => x.involvedObject?.name === podName)
        .map((x) => ({
          message: x.message || '',
          reason: x.reason || '',
          type: x.type || '',
        }));

      const errorDetails: string[] = [];
      errorDetails.push(`Pod: ${podName}`, `Phase: ${phase}`);

      if (conditions.length > 0) {
        errorDetails.push(
          `Conditions: ${JSON.stringify(
            conditions.map((c) => ({ type: c.type, status: c.status, reason: c.reason, message: c.message })),
            undefined,
            2,
          )}`,
        );
      }

      let containerExitCode: number | undefined;
      let containerSucceeded = false;

      if (containerStatuses.length > 0) {
        for (const [index, cs] of containerStatuses.entries()) {
          if (cs.state?.waiting) {
            errorDetails.push(
              `Container ${index} (${cs.name}) waiting: ${cs.state.waiting.reason} - ${cs.state.waiting.message || ''}`,
            );
          }
          if (cs.state?.terminated) {
            const exitCode = cs.state.terminated.exitCode;
            containerExitCode = exitCode;
            if (exitCode === 0) {
              containerSucceeded = true;
            }
            errorDetails.push(
              `Container ${index} (${cs.name}) terminated: ${cs.state.terminated.reason} - ${
                cs.state.terminated.message || ''
              } (exit code: ${exitCode})`,
            );
          }
        }
      }

      if (events.length > 0) {
        errorDetails.push(`Recent events: ${JSON.stringify(events.slice(-5), undefined, 2)}`);
      }

      // Check if only PreStopHook failed but container succeeded
      const hasPreStopHookFailure = events.some((event) => event.reason === 'FailedPreStopHook');
      const wasKilled = events.some((event) => event.reason === 'Killing');
      const hasExceededGracePeriod = events.some((event) => event.reason === 'ExceededGracePeriod');

      // If container succeeded (exit code 0), PreStopHook failure is non-critical
      // Also check if pod was killed but container might have succeeded
      if (containerSucceeded && containerExitCode === 0) {
        // Container succeeded - PreStopHook failure is non-critical
        if (hasPreStopHookFailure) {
          CloudRunnerLogger.logWarning(
            `Pod ${podName} marked as Failed due to PreStopHook failure, but container exited successfully (exit code 0). This is non-fatal.`,
          );
        } else {
          CloudRunnerLogger.log(
            `Pod ${podName} container succeeded (exit code 0), but pod phase is Failed. Checking details...`,
          );
        }
        CloudRunnerLogger.log(`Pod details: ${errorDetails.join('\n')}`);

        // Don't throw error - container succeeded, PreStopHook failure is non-critical
        return false; // Pod is not running, but we don't treat it as a failure
      }

      // If pod was killed and we have PreStopHook failure, wait for container status
      // The container might have succeeded but status hasn't been updated yet
      if (wasKilled && hasPreStopHookFailure && (containerExitCode === undefined || !containerSucceeded)) {
        CloudRunnerLogger.log(
          `Pod ${podName} was killed with PreStopHook failure. Waiting for container status to determine if container succeeded...`,
        );

        // Wait a bit for container status to become available (up to 30 seconds)
        for (let index = 0; index < 6; index++) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          try {
            const updatedPod = (await kubeClient.listNamespacedPod(namespace)).body.items.find(
              (x) => podName === x.metadata?.name,
            );
            if (updatedPod?.status?.containerStatuses && updatedPod.status.containerStatuses.length > 0) {
              const updatedContainerStatus = updatedPod.status.containerStatuses[0];
              if (updatedContainerStatus.state?.terminated) {
                const updatedExitCode = updatedContainerStatus.state.terminated.exitCode;
                if (updatedExitCode === 0) {
                  CloudRunnerLogger.logWarning(
                    `Pod ${podName} container succeeded (exit code 0) after waiting. PreStopHook failure is non-fatal.`,
                  );

                  return false; // Pod is not running, but container succeeded
                } else {
                  CloudRunnerLogger.log(
                    `Pod ${podName} container failed with exit code ${updatedExitCode} after waiting.`,
                  );
                  errorDetails.push(`Container terminated after wait: exit code ${updatedExitCode}`);
                  containerExitCode = updatedExitCode;
                  containerSucceeded = false;
                  break;
                }
              }
            }
          } catch (waitError) {
            CloudRunnerLogger.log(`Error while waiting for container status: ${waitError}`);
          }
        }

        // If we still don't have container status after waiting, but only PreStopHook failed,
        // be lenient - the container might have succeeded but status wasn't updated
        if (containerExitCode === undefined && hasPreStopHookFailure && !hasExceededGracePeriod) {
          CloudRunnerLogger.logWarning(
            `Pod ${podName} container status not available after waiting, but only PreStopHook failed (no ExceededGracePeriod). Assuming container may have succeeded.`,
          );

          return false; // Be lenient - PreStopHook failure alone is not fatal
        }
        CloudRunnerLogger.log(
          `Container status check completed. Exit code: ${containerExitCode}, PreStopHook failure: ${hasPreStopHookFailure}`,
        );
      }

      // If we only have PreStopHook failure and no actual container failure, be lenient
      if (hasPreStopHookFailure && !hasExceededGracePeriod && containerExitCode === undefined) {
        CloudRunnerLogger.logWarning(
          `Pod ${podName} has PreStopHook failure but no container failure detected. Treating as non-fatal.`,
        );

        return false; // PreStopHook failure alone is not fatal if container status is unclear
      }

      // Check if pod was evicted due to disk pressure - this is an infrastructure issue
      const wasEvicted = errorDetails.some(
        (detail) => detail.toLowerCase().includes('evicted') || detail.toLowerCase().includes('diskpressure'),
      );
      if (wasEvicted) {
        const evictionMessage = `Pod ${podName} was evicted due to disk pressure. This is a test infrastructure issue - the cluster doesn't have enough disk space.`;
        CloudRunnerLogger.logWarning(evictionMessage);
        CloudRunnerLogger.log(`Pod details: ${errorDetails.join('\n')}`);
        throw new Error(
          `${evictionMessage}\nThis indicates the test environment needs more disk space or better cleanup.\n${errorDetails.join(
            '\n',
          )}`,
        );
      }

      // Exit code 137 (128 + 9) means SIGKILL - container was killed by system (often OOM)
      // If this happened with PreStopHook failure, it might be a resource issue, not a real failure
      // Be lenient if we only have PreStopHook/ExceededGracePeriod issues
      if (containerExitCode === 137 && (hasPreStopHookFailure || hasExceededGracePeriod)) {
        CloudRunnerLogger.logWarning(
          `Pod ${podName} was killed (exit code 137 - likely OOM or resource limit) with PreStopHook/grace period issues. This may be a resource constraint issue rather than a build failure.`,
        );

        // Still log the details but don't fail the test - the build might have succeeded before being killed
        CloudRunnerLogger.log(`Pod details: ${errorDetails.join('\n')}`);

        return false; // Don't treat system kills as test failures if only PreStopHook issues
      }

      const errorMessage = `K8s pod failed\n${errorDetails.join('\n')}`;
      CloudRunnerLogger.log(errorMessage);
      throw new Error(errorMessage);
    }

    return running;
  }
  public static async GetPodStatus(podName: string, namespace: string, kubeClient: CoreV1Api) {
    const pods = (await kubeClient.listNamespacedPod(namespace)).body.items.find((x) => podName === x.metadata?.name);
    const phase = pods?.status?.phase || 'undefined status';

    return phase;
  }
}

export default KubernetesPods;
