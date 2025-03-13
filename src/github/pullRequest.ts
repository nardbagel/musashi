import * as core from '@actions/core';
import { OctokitType } from '../types';

/**
 * Get the diff for a specific pull request
 * 
 * @param octokit - Initialized Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns The PR diff as a string
 */
export async function getPullRequestDiff(
  octokit: OctokitType,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  try {
    core.debug(`Fetching diff for PR #${prNumber} in ${owner}/${repo}`);

    // Get the PR details
    await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    // Get the files changed in the PR
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    });

    core.debug(`PR #${prNumber} has ${files.length} changed files`);

    // Fetch the raw diff
    const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: prNumber,
      headers: {
        accept: 'application/vnd.github.v3.diff'
      }
    });

    // The response.data is a string when using the diff media type
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Failed to fetch PR diff: ${error.message}`);
    } else {
      core.error(`Failed to fetch PR diff: Unknown error`);
    }
    throw error;
  }
} 