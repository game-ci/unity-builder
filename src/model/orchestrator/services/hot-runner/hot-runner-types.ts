export interface HotRunnerConfig {
  enabled: boolean;
  transport: 'websocket' | 'grpc' | 'named-pipe';
  host: string;
  port: number;
  healthCheckInterval: number; // seconds
  maxIdleTime: number; // seconds before recycling
  maxJobsBeforeRecycle: number;
  unityVersion?: string;
  platform?: string;
}

export interface HotRunnerStatus {
  id: string;
  state: 'idle' | 'busy' | 'starting' | 'stopping' | 'unhealthy';
  unityVersion: string;
  platform: string;
  currentJob?: string;
  lastJobCompleted?: string;
  uptime: number;
  jobsCompleted: number;
  lastHealthCheck: string;
  memoryUsageMB: number;
  libraryHash?: string;
}

export interface HotRunnerJobRequest {
  jobId: string;
  buildMethod?: string;
  buildTarget: string;
  buildPath?: string;
  customParameters?: Record<string, string>;
  timeout: number;
  testMode?: 'editmode' | 'playmode';
  testSuitePath?: string;
}

export interface HotRunnerJobResult {
  jobId: string;
  success: boolean;
  exitCode: number;
  duration: number;
  output: string;
  artifacts?: string[];
  testResults?: string; // path to test result file
}

export interface HotRunnerTransport {
  connect(config: HotRunnerConfig): Promise<void>;
  disconnect(): Promise<void>;
  sendJob(request: HotRunnerJobRequest): Promise<HotRunnerJobResult>;
  getStatus(): Promise<HotRunnerStatus>;
  healthCheck(): Promise<boolean>;
}
