import * as core from "@actions/core";
import type { Octokit } from "octokit";

/**
 * Get detailed information about a pull request including description and comments
 *
 * @param octokit - Initialized Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns Object containing PR title, description, and comments
 */
export async function getPullRequestContext(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ title: string; description: string; comments: string[] }> {
  try {
    core.debug(`Fetching context for PR #${prNumber} in ${owner}/${repo}`);

    // Get the PR details including title and body
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get comments on the PR
    const { data: issueComments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    // Get review comments on the PR (comments on specific lines of code)
    const { data: reviewComments } =
      await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
      });

    // Get reviews on the PR
    const { data: reviews } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Extract all comments as strings
    const issueCommentStrings = issueComments.map(
      (comment: { user?: { login?: string }; body?: string }) =>
        `${comment.user?.login || "Unknown"}: ${comment.body || ""}`
    );

    const reviewCommentStrings = reviewComments.map(
      (comment: {
        user?: { login?: string };
        path?: string;
        line?: number;
        body?: string;
      }) =>
        `${comment.user?.login || "Unknown"} (on ${comment.path || ""}:${
          comment.line || "?"
        }): ${comment.body || ""}`
    );

    const reviewStrings = reviews
      .filter(
        (review: { body?: string }) =>
          review.body && review.body.trim().length > 0
      )
      .map(
        (review: {
          user?: { login?: string };
          state?: string;
          body?: string;
        }) =>
          `${review.user?.login || "Unknown"} (${review.state || "unknown"}): ${
            review.body || ""
          }`
      );

    // Combine all comments
    const allComments = [
      ...issueCommentStrings,
      ...reviewCommentStrings,
      ...reviewStrings,
    ];

    core.debug(`Found ${allComments.length} comments for PR #${prNumber}`);

    return {
      title: pr.title || "No title",
      description: pr.body || "No description",
      comments: allComments,
    };
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Failed to fetch PR context: ${error.message}`);
    } else {
      core.error(`Failed to fetch PR context: Unknown error`);
    }
    // Return empty context instead of throwing to avoid breaking the main flow
    return {
      title: "Error fetching PR title",
      description: "Error fetching PR description",
      comments: ["Error fetching PR comments"],
    };
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
