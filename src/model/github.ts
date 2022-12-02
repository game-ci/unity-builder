import { Octokit } from '@octokit/core';

class GitHub {
  public static githubInputEnabled: boolean = true;

  public static async updateGitHubCheck() {
    const octokit = new Octokit({
      auth: 'YOUR-TOKEN',
    });

    const data: any = {
      owner: 'OWNER',
      repo: 'REPO',
      // eslint-disable-next-line camelcase
      check_run_id: 0,
      name: 'mighty_readme',
      // eslint-disable-next-line camelcase
      started_at: '2018-05-04T01:14:52Z',
      status: `completed`,
      conclusion: 'success',
      // eslint-disable-next-line camelcase
      completed_at: '2018-05-04T01:14:52Z',
      output: {
        title: 'Mighty Readme report',
        summary: 'There are 0 failures, 2 warnings, and 1 notices.',
        text: 'You may have some misspelled words on lines 2 and 4. You also may want to add a section in your README about how to install your app.',
        annotations: [
          {
            path: 'README.md',
            // eslint-disable-next-line camelcase
            annotation_level: 'warning',
            title: 'Spell Checker',
            message: "Check your spelling for 'banaas'.",
            // eslint-disable-next-line camelcase
            raw_details: "Do you mean 'bananas' or 'banana'?",
            // eslint-disable-next-line camelcase
            start_line: 2,
            // eslint-disable-next-line camelcase
            end_line: 2,
          },
          {
            path: 'README.md',
            // eslint-disable-next-line camelcase
            annotation_level: 'warning',
            title: 'Spell Checker',
            message: "Check your spelling for 'aples'",
            // eslint-disable-next-line camelcase
            raw_details: "Do you mean 'apples' or 'Naples'",
            // eslint-disable-next-line camelcase
            start_line: 4,
            // eslint-disable-next-line camelcase
            end_line: 4,
          },
        ],
        images: [
          {
            alt: 'Super bananas',
            // eslint-disable-next-line camelcase
            image_url: 'http://example.com/images/42',
          },
        ],
      },
    };

    await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', data);
  }

  public static async createGitHubCheck() {
    // call github api to create a check
    const octokit = new Octokit({
      auth: 'YOUR-TOKEN',
    });

    await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
      owner: 'OWNER',
      repo: 'REPO',
      name: 'mighty_readme',
      // eslint-disable-next-line camelcase
      head_sha: 'ce587453ced02b1526dfb4cb910479d431683101',
      status: 'in_progress',
      // eslint-disable-next-line camelcase
      external_id: '42',
      // eslint-disable-next-line camelcase
      started_at: '2018-05-04T01:14:52Z',
      output: {
        title: 'Mighty Readme report',
        summary: '',
        text: '',
      },
    });
  }
}

export default GitHub;
