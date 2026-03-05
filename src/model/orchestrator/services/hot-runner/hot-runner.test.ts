import fs from 'node:fs';
import { HotRunnerRegistry } from './hot-runner-registry';
import { HotRunnerHealthMonitor } from './hot-runner-health-monitor';
import { HotRunnerDispatcher } from './hot-runner-dispatcher';
import { HotRunnerService } from './hot-runner-service';
import {
  HotRunnerConfig,
  HotRunnerJobRequest,
  HotRunnerJobResult,
  HotRunnerStatus,
  HotRunnerTransport,
} from './hot-runner-types';

// Mock dependencies
jest.mock('node:fs');
jest.mock('../core/orchestrator-logger');

const mockFs = fs as jest.Mocked<typeof fs>;

function createMockConfig(overrides?: Partial<HotRunnerConfig>): HotRunnerConfig {
  return {
    enabled: true,
    transport: 'websocket',
    host: 'localhost',
    port: 9090,
    healthCheckInterval: 30,
    maxIdleTime: 3600,
    maxJobsBeforeRecycle: 100,
    unityVersion: '2022.3.0f1',
    platform: 'StandaloneWindows64',
    ...overrides,
  };
}

function createMockTransport(overrides?: Partial<HotRunnerTransport>): HotRunnerTransport {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    sendJob: jest.fn().mockResolvedValue({
      jobId: 'test-job',
      success: true,
      exitCode: 0,
      duration: 5000,
      output: 'Build succeeded',
      artifacts: ['build/output.exe'],
    } as HotRunnerJobResult),
    getStatus: jest.fn().mockResolvedValue({
      id: 'mock-runner',
      state: 'idle',
      unityVersion: '2022.3.0f1',
      platform: 'StandaloneWindows64',
      uptime: 3600,
      jobsCompleted: 5,
      lastHealthCheck: new Date().toISOString(),
      memoryUsageMB: 1024,
    } as HotRunnerStatus),
    healthCheck: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function createMockJobRequest(overrides?: Partial<HotRunnerJobRequest>): HotRunnerJobRequest {
  return {
    jobId: 'job-001',
    buildTarget: 'StandaloneWindows64',
    timeout: 60000,
    ...overrides,
  };
}

// --- Registry Tests ---

describe('HotRunnerRegistry', () => {
  let registry: HotRunnerRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new HotRunnerRegistry();
  });

  it('should register a runner and return an ID', () => {
    const config = createMockConfig();
    const id = registry.registerRunner(config);

    expect(id).toMatch(/^hr-/);
    expect(registry.size).toBe(1);
  });

  it('should retrieve a registered runner by ID', () => {
    const config = createMockConfig();
    const id = registry.registerRunner(config);
    const runner = registry.getRunner(id);

    expect(runner).toBeDefined();
    expect(runner!.id).toBe(id);
    expect(runner!.state).toBe('starting');
    expect(runner!.unityVersion).toBe('2022.3.0f1');
    expect(runner!.platform).toBe('StandaloneWindows64');
  });

  it('should return undefined for unknown runner ID', () => {
    const runner = registry.getRunner('nonexistent');
    expect(runner).toBeUndefined();
  });

  it('should unregister a runner', () => {
    const id = registry.registerRunner(createMockConfig());
    expect(registry.size).toBe(1);

    registry.unregisterRunner(id);
    expect(registry.size).toBe(0);
    expect(registry.getRunner(id)).toBeUndefined();
  });

  it('should handle unregistering a nonexistent runner gracefully', () => {
    registry.unregisterRunner('nonexistent');
    expect(registry.size).toBe(0);
  });

  it('should list all runners without filter', () => {
    registry.registerRunner(createMockConfig({ platform: 'StandaloneWindows64' }));
    registry.registerRunner(createMockConfig({ platform: 'StandaloneLinux64' }));
    registry.registerRunner(createMockConfig({ platform: 'StandaloneOSX' }));

    const all = registry.listRunners();
    expect(all).toHaveLength(3);
  });

  it('should filter runners by platform', () => {
    registry.registerRunner(createMockConfig({ platform: 'StandaloneWindows64' }));
    registry.registerRunner(createMockConfig({ platform: 'StandaloneLinux64' }));
    registry.registerRunner(createMockConfig({ platform: 'StandaloneWindows64' }));

    const windows = registry.listRunners({ platform: 'StandaloneWindows64' });
    expect(windows).toHaveLength(2);

    const linux = registry.listRunners({ platform: 'StandaloneLinux64' });
    expect(linux).toHaveLength(1);
  });

  it('should filter runners by state', () => {
    const id1 = registry.registerRunner(createMockConfig());
    const id2 = registry.registerRunner(createMockConfig());

    registry.updateRunner(id1, { state: 'idle' });
    // id2 remains in 'starting' state

    const idle = registry.listRunners({ state: 'idle' });
    expect(idle).toHaveLength(1);
    expect(idle[0].id).toBe(id1);
  });

  it('should filter runners by Unity version', () => {
    registry.registerRunner(createMockConfig({ unityVersion: '2022.3.0f1' }));
    registry.registerRunner(createMockConfig({ unityVersion: '2023.1.0f1' }));
    registry.registerRunner(createMockConfig({ unityVersion: '2022.3.0f1' }));

    const v2022 = registry.listRunners({ unityVersion: '2022.3.0f1' });
    expect(v2022).toHaveLength(2);
  });

  it('should find an available idle runner matching requirements', () => {
    const id1 = registry.registerRunner(
      createMockConfig({ unityVersion: '2022.3.0f1', platform: 'StandaloneWindows64' }),
    );
    registry.updateRunner(id1, { state: 'idle' });

    const id2 = registry.registerRunner(
      createMockConfig({ unityVersion: '2023.1.0f1', platform: 'StandaloneLinux64' }),
    );
    registry.updateRunner(id2, { state: 'idle' });

    const found = registry.findAvailableRunner({
      unityVersion: '2022.3.0f1',
      platform: 'StandaloneWindows64',
    });

    expect(found).toBeDefined();
    expect(found!.id).toBe(id1);
  });

  it('should return undefined when no runner matches requirements', () => {
    const id = registry.registerRunner(
      createMockConfig({ unityVersion: '2022.3.0f1', platform: 'StandaloneWindows64' }),
    );
    registry.updateRunner(id, { state: 'idle' });

    const found = registry.findAvailableRunner({
      unityVersion: '2023.1.0f1',
      platform: 'StandaloneLinux64',
    });

    expect(found).toBeUndefined();
  });

  it('should update runner status fields', () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle', memoryUsageMB: 2048 });

    const runner = registry.getRunner(id);
    expect(runner!.state).toBe('idle');
    expect(runner!.memoryUsageMB).toBe(2048);
    // ID should not be overridden by the update
    expect(runner!.id).toBe(id);
  });

  it('should persist and load registry from disk', () => {
    const persistenceRegistry = new HotRunnerRegistry('/tmp/test');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => '' as any);

    const id = persistenceRegistry.registerRunner(createMockConfig());

    // Verify writeFileSync was called for persistence
    expect(mockFs.writeFileSync).toHaveBeenCalled();
    const writtenData = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    expect(writtenData.runners).toBeDefined();
    expect(writtenData.runners[id]).toBeDefined();
  });

  it('should load runners from disk on loadFromDisk', () => {
    const persistenceRegistry = new HotRunnerRegistry('/tmp/test');
    const storedData = {
      runners: {
        'hr-restored': {
          id: 'hr-restored',
          state: 'idle',
          unityVersion: '2022.3.0f1',
          platform: 'StandaloneWindows64',
          uptime: 100,
          jobsCompleted: 3,
          lastHealthCheck: new Date().toISOString(),
          memoryUsageMB: 512,
        },
      },
      configs: {
        'hr-restored': createMockConfig(),
      },
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(storedData));

    const count = persistenceRegistry.loadFromDisk();
    expect(count).toBe(1);
    expect(persistenceRegistry.getRunner('hr-restored')).toBeDefined();
  });
});

// --- Health Monitor Tests ---

describe('HotRunnerHealthMonitor', () => {
  let monitor: HotRunnerHealthMonitor;
  let registry: HotRunnerRegistry;
  let transports: Map<string, HotRunnerTransport>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    monitor = new HotRunnerHealthMonitor();
    registry = new HotRunnerRegistry();
    transports = new Map();
  });

  afterEach(() => {
    monitor.stopMonitoring();
    jest.useRealTimers();
  });

  it('should start and stop monitoring', () => {
    monitor.startMonitoring(registry, 30, transports);
    expect(monitor.isMonitoring).toBe(true);

    monitor.stopMonitoring();
    expect(monitor.isMonitoring).toBe(false);
  });

  it('should report healthy when transport health check passes', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle' });

    const transport = createMockTransport();
    transports.set(id, transport);
    monitor.startMonitoring(registry, 30, transports);

    const healthy = await monitor.checkHealth(id);
    expect(healthy).toBe(true);
    expect(transport.healthCheck).toHaveBeenCalled();
  });

  it('should mark runner as unhealthy when health check fails', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle' });

    const transport = createMockTransport({
      healthCheck: jest.fn().mockResolvedValue(false),
    });
    transports.set(id, transport);
    monitor.startMonitoring(registry, 30, transports);

    const healthy = await monitor.checkHealth(id);
    expect(healthy).toBe(false);

    const runner = registry.getRunner(id);
    expect(runner!.state).toBe('unhealthy');
  });

  it('should mark runner as unhealthy when health check throws', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle' });

    const transport = createMockTransport({
      healthCheck: jest.fn().mockRejectedValue(new Error('Connection refused')),
    });
    transports.set(id, transport);
    monitor.startMonitoring(registry, 30, transports);

    const healthy = await monitor.checkHealth(id);
    expect(healthy).toBe(false);
  });

  it('should recycle unhealthy runner and remove from registry', async () => {
    const id = registry.registerRunner(createMockConfig());
    const transport = createMockTransport();
    transports.set(id, transport);
    monitor.startMonitoring(registry, 30, transports);

    await monitor.recycleUnhealthyRunner(id);

    expect(registry.getRunner(id)).toBeUndefined();
    expect(transport.disconnect).toHaveBeenCalled();
    expect(transports.has(id)).toBe(false);
  });

  it('should recycle idle runner when max idle time exceeded', async () => {
    const id = registry.registerRunner(createMockConfig({ maxIdleTime: 60 }));
    // Set lastHealthCheck to 120 seconds ago
    const oldDate = new Date(Date.now() - 120 * 1000).toISOString();
    registry.updateRunner(id, { state: 'idle', lastHealthCheck: oldDate });

    const transport = createMockTransport();
    transports.set(id, transport);
    monitor.startMonitoring(registry, 30, transports);

    await monitor.recycleIdleRunner(id, 60);

    expect(registry.getRunner(id)).toBeUndefined();
  });

  it('should not recycle idle runner when within max idle time', async () => {
    const id = registry.registerRunner(createMockConfig({ maxIdleTime: 3600 }));
    registry.updateRunner(id, {
      state: 'idle',
      lastHealthCheck: new Date().toISOString(),
    });

    const transport = createMockTransport();
    transports.set(id, transport);
    monitor.startMonitoring(registry, 30, transports);

    await monitor.recycleIdleRunner(id, 3600);

    // Runner should still exist
    expect(registry.getRunner(id)).toBeDefined();
  });

  it('should return false when no transport exists for runner', async () => {
    const id = registry.registerRunner(createMockConfig());
    // Do not set any transport for this runner
    monitor.startMonitoring(registry, 30, transports);

    const healthy = await monitor.checkHealth(id);
    expect(healthy).toBe(false);
  });
});

// --- Dispatcher Tests ---

describe('HotRunnerDispatcher', () => {
  let registry: HotRunnerRegistry;
  let transports: Map<string, HotRunnerTransport>;
  let dispatcher: HotRunnerDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new HotRunnerRegistry();
    transports = new Map();
    dispatcher = new HotRunnerDispatcher(transports);
  });

  it('should dispatch a job to an available runner', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle' });

    const transport = createMockTransport();
    transports.set(id, transport);

    const request = createMockJobRequest();
    const result = await dispatcher.dispatchJob(request, registry, '2022.3.0f1');

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(transport.sendJob).toHaveBeenCalledWith(request);
  });

  it('should mark runner as busy during job execution', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle' });

    let statesDuringJob: string[] = [];
    const transport = createMockTransport({
      sendJob: jest.fn().mockImplementation(async () => {
        const runner = registry.getRunner(id);
        if (runner) statesDuringJob.push(runner.state);

        return {
          jobId: 'job-001',
          success: true,
          exitCode: 0,
          duration: 1000,
          output: 'ok',
        };
      }),
    });
    transports.set(id, transport);

    await dispatcher.dispatchJob(createMockJobRequest(), registry, '2022.3.0f1');

    expect(statesDuringJob).toContain('busy');
    // After completion, should be idle again
    const runner = registry.getRunner(id);
    expect(runner!.state).toBe('idle');
  });

  it('should increment jobsCompleted after successful dispatch', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle', jobsCompleted: 5 });

    const transport = createMockTransport();
    transports.set(id, transport);

    await dispatcher.dispatchJob(createMockJobRequest(), registry, '2022.3.0f1');

    const runner = registry.getRunner(id);
    expect(runner!.jobsCompleted).toBe(6);
  });

  it('should throw when no runner is available and wait times out', async () => {
    // No runners registered at all
    const request = createMockJobRequest({ timeout: 100 });

    await expect(dispatcher.dispatchJob(request, registry, '2022.3.0f1')).rejects.toThrow(/Timed out waiting/);
  });

  it('should throw when runner has no transport', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle' });
    // No transport set for this runner

    const request = createMockJobRequest();

    await expect(dispatcher.dispatchJob(request, registry, '2022.3.0f1')).rejects.toThrow(/No transport available/);
  });

  it('should handle job failure and return runner to idle', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle' });

    const transport = createMockTransport({
      sendJob: jest.fn().mockRejectedValue(new Error('Unity crashed')),
    });
    transports.set(id, transport);

    await expect(dispatcher.dispatchJob(createMockJobRequest(), registry, '2022.3.0f1')).rejects.toThrow(
      'Unity crashed',
    );

    // Runner should be back to idle despite failure
    const runner = registry.getRunner(id);
    expect(runner!.state).toBe('idle');
  });

  it('should handle job timeout', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle' });

    const transport = createMockTransport({
      sendJob: jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 60000)), // never resolves within timeout
      ),
    });
    transports.set(id, transport);

    const request = createMockJobRequest({ timeout: 50 });

    await expect(dispatcher.dispatchJob(request, registry, '2022.3.0f1')).rejects.toThrow(/timed out/);
  });

  it('should call output callback with job output', async () => {
    const id = registry.registerRunner(createMockConfig());
    registry.updateRunner(id, { state: 'idle' });

    const transport = createMockTransport();
    transports.set(id, transport);

    const outputCallback = jest.fn();
    await dispatcher.dispatchJob(createMockJobRequest(), registry, '2022.3.0f1', outputCallback);

    expect(outputCallback).toHaveBeenCalledWith('Build succeeded');
  });

  it('should wait for runner to become available', async () => {
    const id = registry.registerRunner(createMockConfig());
    // Runner starts in 'starting' state, not idle

    const transport = createMockTransport();
    transports.set(id, transport);

    // Simulate runner becoming idle after a short delay
    setTimeout(() => {
      registry.updateRunner(id, { state: 'idle' });
    }, 50);

    const request = createMockJobRequest({ timeout: 5000 });
    const result = await dispatcher.dispatchJob(request, registry, '2022.3.0f1');

    expect(result.success).toBe(true);
  });
});

// --- Service Integration Tests ---

describe('HotRunnerService', () => {
  let service: HotRunnerService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    service = new HotRunnerService();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  it('should initialize and shut down cleanly', async () => {
    const config = createMockConfig();
    await service.initialize(config);

    const status = service.getStatus();
    expect(status).toEqual([]);

    await service.shutdown();
  });

  it('should register a runner with transport', async () => {
    await service.initialize(createMockConfig());

    const transport = createMockTransport();
    const id = service.registerRunner(createMockConfig(), transport);

    expect(id).toMatch(/^hr-/);
    expect(service.getStatus()).toHaveLength(1);
  });

  it('should disconnect all transports on shutdown', async () => {
    await service.initialize(createMockConfig());

    const transport1 = createMockTransport();
    const transport2 = createMockTransport();
    service.registerRunner(createMockConfig(), transport1);
    service.registerRunner(createMockConfig(), transport2);

    await service.shutdown();

    expect(transport1.disconnect).toHaveBeenCalled();
    expect(transport2.disconnect).toHaveBeenCalled();
  });

  it('should expose the underlying registry', async () => {
    await service.initialize(createMockConfig());
    const registry = service.getRegistry();

    expect(registry).toBeInstanceOf(HotRunnerRegistry);
  });
});
