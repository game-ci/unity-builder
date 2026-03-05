import { RunnerAvailabilityService } from './runner-availability-service';

// Mock @octokit/core
jest.mock('@octokit/core', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

jest.mock('./orchestrator-logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    logWarning: jest.fn(),
    error: jest.fn(),
  },
}));

import { Octokit } from '@octokit/core';

const MockedOctokit = Octokit as jest.MockedClass<typeof Octokit>;

function createMockRunners(runners: Array<{ name: string; status: string; busy: boolean; labels: string[] }>) {
  return runners.map((r, i) => ({
    id: i + 1,
    name: r.name,
    status: r.status,
    busy: r.busy,
    labels: r.labels.map((l) => ({ name: l })),
  }));
}

describe('RunnerAvailabilityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAvailability', () => {
    it('should skip check and not fallback when no token is provided', async () => {
      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', '', [], 1);
      expect(result.shouldFallback).toBe(false);
      expect(result.reason).toContain('No GitHub token');
    });

    it('should fallback when no runners are registered', async () => {
      const mockRequest = jest.fn().mockResolvedValue({ data: { runners: [] } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);
      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toContain('No runners registered');
      expect(result.totalRunners).toBe(0);
    });

    it('should not fallback when enough idle runners are available', async () => {
      const runners = createMockRunners([
        { name: 'runner-1', status: 'online', busy: false, labels: ['self-hosted', 'linux'] },
        { name: 'runner-2', status: 'online', busy: false, labels: ['self-hosted', 'linux'] },
      ]);
      const mockRequest = jest.fn().mockResolvedValue({ data: { runners } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);
      expect(result.shouldFallback).toBe(false);
      expect(result.idleRunners).toBe(2);
      expect(result.totalRunners).toBe(2);
    });

    it('should fallback when all runners are busy', async () => {
      const runners = createMockRunners([
        { name: 'runner-1', status: 'online', busy: true, labels: ['self-hosted'] },
        { name: 'runner-2', status: 'online', busy: true, labels: ['self-hosted'] },
      ]);
      const mockRequest = jest.fn().mockResolvedValue({ data: { runners } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);
      expect(result.shouldFallback).toBe(true);
      expect(result.idleRunners).toBe(0);
      expect(result.matchingRunners).toBe(2);
    });

    it('should fallback when all runners are offline', async () => {
      const runners = createMockRunners([
        { name: 'runner-1', status: 'offline', busy: false, labels: ['self-hosted'] },
      ]);
      const mockRequest = jest.fn().mockResolvedValue({ data: { runners } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);
      expect(result.shouldFallback).toBe(true);
      expect(result.idleRunners).toBe(0);
    });

    it('should filter runners by required labels', async () => {
      const runners = createMockRunners([
        { name: 'linux-runner', status: 'online', busy: false, labels: ['self-hosted', 'linux'] },
        { name: 'windows-runner', status: 'online', busy: false, labels: ['self-hosted', 'windows'] },
      ]);
      const mockRequest = jest.fn().mockResolvedValue({ data: { runners } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability(
        'owner',
        'repo',
        'token',
        ['self-hosted', 'linux'],
        1,
      );

      expect(result.shouldFallback).toBe(false);
      expect(result.matchingRunners).toBe(1);
      expect(result.idleRunners).toBe(1);
      expect(result.totalRunners).toBe(2);
    });

    it('should fallback when no runners match required labels', async () => {
      const runners = createMockRunners([
        { name: 'windows-runner', status: 'online', busy: false, labels: ['self-hosted', 'windows'] },
      ]);
      const mockRequest = jest.fn().mockResolvedValue({ data: { runners } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability(
        'owner',
        'repo',
        'token',
        ['self-hosted', 'linux'],
        1,
      );

      expect(result.shouldFallback).toBe(true);
      expect(result.matchingRunners).toBe(0);
      expect(result.idleRunners).toBe(0);
    });

    it('should respect minAvailable threshold', async () => {
      const runners = createMockRunners([
        { name: 'runner-1', status: 'online', busy: false, labels: ['self-hosted'] },
      ]);
      const mockRequest = jest.fn().mockResolvedValue({ data: { runners } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      // Need 2, have 1 — should fallback
      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 2);
      expect(result.shouldFallback).toBe(true);
      expect(result.idleRunners).toBe(1);
    });

    it('should be case-insensitive for label matching', async () => {
      const runners = createMockRunners([
        { name: 'runner-1', status: 'online', busy: false, labels: ['Self-Hosted', 'Linux'] },
      ]);
      const mockRequest = jest.fn().mockResolvedValue({ data: { runners } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability(
        'owner',
        'repo',
        'token',
        ['self-hosted', 'linux'],
        1,
      );
      expect(result.shouldFallback).toBe(false);
      expect(result.matchingRunners).toBe(1);
    });

    it('should not fallback on API error (fail-open)', async () => {
      const mockRequest = jest.fn().mockRejectedValue(new Error('403 Forbidden'));
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);
      expect(result.shouldFallback).toBe(false);
      expect(result.reason).toContain('Runner check failed');
    });

    it('should count only online+idle runners', async () => {
      const runners = createMockRunners([
        { name: 'idle', status: 'online', busy: false, labels: ['self-hosted'] },
        { name: 'busy', status: 'online', busy: true, labels: ['self-hosted'] },
        { name: 'offline', status: 'offline', busy: false, labels: ['self-hosted'] },
      ]);
      const mockRequest = jest.fn().mockResolvedValue({ data: { runners } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);
      expect(result.shouldFallback).toBe(false);
      expect(result.totalRunners).toBe(3);
      expect(result.matchingRunners).toBe(3);
      expect(result.idleRunners).toBe(1);
    });
  });
});
