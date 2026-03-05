import { Octokit } from '@octokit/core';
import OrchestratorLogger from './orchestrator-logger';

interface GitHubRunner {
  id: number;
  name: string;
  status: 'online' | 'offline';
  busy: boolean;
  labels: Array<{ name: string }>;
}

interface RunnerCheckResult {
  shouldFallback: boolean;
  reason: string;
  totalRunners: number;
  matchingRunners: number;
  idleRunners: number;
}

/**
 * Checks GitHub Actions runner availability to support automatic provider fallback.
 *
 * When a user configures `runnerCheckEnabled: true` with a `fallbackProviderStrategy`,
 * this service queries the GitHub API for runner status before the build starts.
 * If insufficient runners are available, the orchestrator routes to the fallback provider.
 */
export class RunnerAvailabilityService {
  /**
   * Check if enough runners are available to handle the build.
   *
   * @param owner - GitHub repository owner
   * @param repo - GitHub repository name
   * @param token - GitHub token with repo/actions scope
   * @param requiredLabels - Labels runners must have (empty = any runner)
   * @param minAvailable - Minimum idle runners required
   * @returns RunnerCheckResult with decision and diagnostics
   */
  static async checkAvailability(
    owner: string,
    repo: string,
    token: string,
    requiredLabels: string[],
    minAvailable: number,
  ): Promise<RunnerCheckResult> {
    if (!token) {
      return {
        shouldFallback: false,
        reason: 'No GitHub token available — skipping runner check',
        totalRunners: 0,
        matchingRunners: 0,
        idleRunners: 0,
      };
    }

    try {
      const octokit = new Octokit({ auth: token });

      // Fetch all runners for the repository
      const runners = await RunnerAvailabilityService.fetchRunners(octokit, owner, repo);

      if (runners.length === 0) {
        return {
          shouldFallback: true,
          reason: 'No runners registered for this repository',
          totalRunners: 0,
          matchingRunners: 0,
          idleRunners: 0,
        };
      }

      // Filter by required labels
      const matching = RunnerAvailabilityService.filterByLabels(runners, requiredLabels);

      // Count idle (online + not busy)
      const idle = matching.filter((r) => r.status === 'online' && !r.busy);

      const result: RunnerCheckResult = {
        shouldFallback: idle.length < minAvailable,
        reason:
          idle.length >= minAvailable
            ? `${idle.length} idle runner(s) available (need ${minAvailable})`
            : `Only ${idle.length} idle runner(s) available, need ${minAvailable}`,
        totalRunners: runners.length,
        matchingRunners: matching.length,
        idleRunners: idle.length,
      };

      return result;
    } catch (error: any) {
      // If the API call fails (permissions, rate limit, etc.), don't block the build
      OrchestratorLogger.log(`Runner availability check failed: ${error.message}`);

      return {
        shouldFallback: false,
        reason: `Runner check failed (${error.message}) — proceeding with primary provider`,
        totalRunners: 0,
        matchingRunners: 0,
        idleRunners: 0,
      };
    }
  }

  /**
   * Fetch all runners for a repository, handling pagination.
   */
  private static async fetchRunners(octokit: Octokit, owner: string, repo: string): Promise<GitHubRunner[]> {
    const allRunners: GitHubRunner[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await octokit.request('GET /repos/{owner}/{repo}/actions/runners', {
        owner,
        repo,
        per_page: perPage,
        page,
      });

      const runners = (response.data.runners || []) as GitHubRunner[];
      allRunners.push(...runners);

      if (runners.length < perPage) break;
      page++;
    }

    return allRunners;
  }

  /**
   * Filter runners by required labels. A runner matches if it has ALL required labels.
   * If requiredLabels is empty, all runners match.
   */
  private static filterByLabels(runners: GitHubRunner[], requiredLabels: string[]): GitHubRunner[] {
    if (requiredLabels.length === 0) return runners;

    return runners.filter((runner) => {
      const runnerLabelNames = runner.labels.map((l) => l.name.toLowerCase());

      return requiredLabels.every((required) => runnerLabelNames.includes(required.toLowerCase()));
    });
  }
}
