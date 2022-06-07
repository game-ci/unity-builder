import CloudRunnerLogger from '../services/cloud-runner-logger.ts';

export class RemoteClientLogger {
  public static log(message: string) {
    CloudRunnerLogger.log(`[Client] ${message}`);
  }

  public static logCliError(message: string) {
    CloudRunnerLogger.log(`[Client][Error] ${message}`);
  }

  public static logCliDiagnostic(message: string) {
    CloudRunnerLogger.log(`[Client][Diagnostic] ${message}`);
  }

  public static logWarning(message) {
    CloudRunnerLogger.logWarning(message);
  }
}
