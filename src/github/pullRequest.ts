import * as core from "@actions/core";
import type { Octokit } from "octokit";

export interface PRContext {
  title: string;
  description: string;
  existingComments: {
    lineComments: Array<{
      path: string;
      line: number;
      body: string;
    }>;
    prComments: Array<{
      body: string;
    }>;
  };
}

interface ReviewComment {
  path: string;
  line?: number;
  body: string;
}

interface IssueComment {
  body: string;
}

/**
 * Get the context for a pull request including title, description, and existing comments
 *
 * @param octokit - Initialized Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns The PR context
 */
export async function getPullRequestContext(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRContext> {
  try {
    core.debug(`Fetching context for PR #${prNumber} in ${owner}/${repo}`);

    // Get PR details
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get existing review comments
    const { data: reviewComments } =
      await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
      });

    // Get existing PR comments
    const { data: issueComments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    // Format the context
    const context: PRContext = {
      title: pr.title,
      description: pr.body || "",
      existingComments: {
        lineComments: reviewComments.map((comment: ReviewComment) => ({
          path: comment.path,
          line: comment.line || 0,
          body: comment.body,
        })),
        prComments: issueComments.map((comment: IssueComment) => ({
          body: comment.body,
        })),
      },
    };

    core.debug(
      `Found ${context.existingComments.lineComments.length} line comments and ${context.existingComments.prComments.length} PR comments`
    );
    return context;
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Failed to fetch PR context: ${error.message}`);
    } else {
      core.error(`Failed to fetch PR context: Unknown error`);
    }
    throw error;
  }
}

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
  octokit: Octokit,
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
      pull_number: prNumber,
    });

    // Get the files changed in the PR
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    core.debug(`PR #${prNumber} has ${files.length} changed files`);

    // Fetch the raw diff
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner,
        repo,
        pull_number: prNumber,
        headers: {
          accept: "application/vnd.github.v3.diff",
        },
      }
    );

    // The response.data is a string when using the diff media type
    return typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data);
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Failed to fetch PR diff: ${error.message}`);
    } else {
      core.error(`Failed to fetch PR diff: Unknown error`);
    }
    throw error;
  }
}
