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
      const mockRequest = jest.fn().mockResolvedValue({ status: 200, data: { runners: [] } });
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
      const mockRequest = jest.fn().mockResolvedValue({ status: 200, data: { runners } });
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
      const mockRequest = jest.fn().mockResolvedValue({ status: 200, data: { runners } });
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
      const mockRequest = jest.fn().mockResolvedValue({ status: 200, data: { runners } });
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
      const mockRequest = jest.fn().mockResolvedValue({ status: 200, data: { runners } });
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
      const mockRequest = jest.fn().mockResolvedValue({ status: 200, data: { runners } });
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
      const mockRequest = jest.fn().mockResolvedValue({ status: 200, data: { runners } });
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
      const mockRequest = jest.fn().mockResolvedValue({ status: 200, data: { runners } });
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
      const mockRequest = jest.fn().mockResolvedValue({ status: 200, data: { runners } });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);
      expect(result.shouldFallback).toBe(false);
      expect(result.totalRunners).toBe(3);
      expect(result.matchingRunners).toBe(3);
      expect(result.idleRunners).toBe(1);
    });
  });

  describe('pagination limits', () => {
    it('should stop paginating after reaching the page limit', async () => {
      // Return full pages (100 runners each) to force continued pagination
      let callCount = 0;
      const mockRequest = jest.fn().mockImplementation(() => {
        callCount++;
        const runners = createMockRunners(
          Array.from({ length: 100 }, (_, i) => ({
            name: `runner-${callCount}-${i}`,
            status: 'online' as const,
            busy: false,
            labels: ['self-hosted'],
          })),
        );

        return Promise.resolve({ status: 200, data: { runners } });
      });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);

      // Should have called at most 100 pages (the MAX_PAGINATION_PAGES limit)
      expect(mockRequest).toHaveBeenCalledTimes(100);
      // Should still have runners from the pages it did fetch
      expect(result.totalRunners).toBe(10000);
      expect(result.shouldFallback).toBe(false);
    });

    it('should stop paginating on rate limit (HTTP 403)', async () => {
      let callCount = 0;
      const mockRequest = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Octokit throws for non-2xx responses
          const error: any = new Error('API rate limit exceeded');
          error.status = 403;
          error.response = {
            status: 403,
            headers: { 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) },
          };

          return Promise.reject(error);
        }
        const runners = createMockRunners(
          Array.from({ length: 100 }, (_, i) => ({
            name: `runner-${i}`,
            status: 'online' as const,
            busy: false,
            labels: ['self-hosted'],
          })),
        );

        return Promise.resolve({ status: 200, data: { runners } });
      });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);

      // Should have stopped at page 2 (rate limited)
      expect(mockRequest).toHaveBeenCalledTimes(2);
      // Should use the 100 runners from the first page
      expect(result.totalRunners).toBe(100);
      expect(result.shouldFallback).toBe(false);
    });

    it('should stop paginating on rate limit (HTTP 429)', async () => {
      let callCount = 0;
      const mockRequest = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Octokit throws for non-2xx responses
          const error: any = new Error('Too Many Requests');
          error.status = 429;
          error.response = { status: 429, headers: {} };

          return Promise.reject(error);
        }

        return Promise.resolve({ status: 200, data: { runners: [] } });
      });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);

      // Should have stopped at first page (rate limited immediately)
      expect(mockRequest).toHaveBeenCalledTimes(1);
      // No runners found — should fallback
      expect(result.totalRunners).toBe(0);
      expect(result.shouldFallback).toBe(true);
    });

    it('should handle pagination timeout gracefully', async () => {
      // Mock Date.now to simulate timeout
      const originalDateNow = Date.now;
      let callCount = 0;

      const mockRequest = jest.fn().mockImplementation(() => {
        callCount++;
        // After first call, advance time past the timeout
        if (callCount >= 2) {
          Date.now = jest.fn(() => originalDateNow() + 31_000);
        }
        const runners = createMockRunners(
          Array.from({ length: 100 }, (_, i) => ({
            name: `runner-${callCount}-${i}`,
            status: 'online' as const,
            busy: false,
            labels: ['self-hosted'],
          })),
        );

        return Promise.resolve({ status: 200, data: { runners } });
      });
      MockedOctokit.mockImplementation(() => ({ request: mockRequest }) as any);

      const result = await RunnerAvailabilityService.checkAvailability('owner', 'repo', 'token', [], 1);

      // Should have stopped after timeout was detected (2 pages: first succeeds, second triggers timeout check)
      expect(mockRequest.mock.calls.length).toBeLessThanOrEqual(3);
      // Should have runners from pages fetched before timeout
      expect(result.totalRunners).toBeGreaterThan(0);

      // Restore
      Date.now = originalDateNow;
    });
  });
});
