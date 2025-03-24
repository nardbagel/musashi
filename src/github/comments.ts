import * as core from "@actions/core";
import { Octokit } from "octokit";
import { Comment, LineComment, PRComment } from "../types";

/**
 * Post comments to a pull request
 *
 * @param octokit - Initialized Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param comments - Array of comment objects to post
 */
export async function postComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  comments: Comment[]
): Promise<void> {
  try {
    core.debug(`Posting ${comments.length} comments to PR #${prNumber}`);

    // Get PR details to get the latest commit SHA
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get the files changed in the PR to get positions
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Process each comment
    for (const comment of comments) {
      if (comment.type === "line") {
        // Find the file in the PR
        const file = files.find(
          (f: { filename: string; patch?: string }) =>
            f.filename === comment.file
        );
        if (!file) {
          core.warning(`File ${comment.file} not found in PR`);
          continue;
        }

        // Post a line comment
        await postLineComment(
          octokit,
          owner,
          repo,
          prNumber,
          comment,
          pr.head.sha,
          file.patch
        );
      } else if (comment.type === "pr") {
        // Post a general PR comment
        await postPrComment(octokit, owner, repo, prNumber, comment);
      } else {
        // This should never happen due to type checking, but just in case
        core.warning(`Unknown comment type: ${(comment as any).type}`);
      }
    }

    core.info(
      `Successfully posted ${comments.length} comments to PR #${prNumber}`
    );
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Failed to post comments: ${error.message}`);
    } else {
      core.error(`Failed to post comments: Unknown error`);
    }
    throw error;
  }
}

/**
 * Find the position in the diff for a given line number
 *
 * @param patch - The file patch from GitHub API
 * @param targetLine - The line number to find
 * @returns The position in the diff
 */
function findPositionInDiff(
  patch: string | undefined,
  targetLine: number
): number | null {
  if (!patch) return null;

  const lines = patch.split("\n");
  let currentLine = 0;
  let position = 0;

  for (const line of lines) {
    position++;
    if (line.startsWith("+") || line.startsWith(" ")) {
      currentLine++;
      if (currentLine === targetLine) {
        return position;
      }
    }
  }

  return null;
}

/**
 * Post a line-specific comment
 *
 * @param octokit - Initialized Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param comment - Comment object with file, line, and body
 */
async function postLineComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  comment: LineComment,
  commitSha: string,
  patch: string | undefined
): Promise<void> {
  try {
    core.debug(`Posting line comment to ${comment.file}:${comment.line}`);

    // Find the position in the diff
    const position = findPositionInDiff(patch, comment.line);
    if (!position) {
      core.warning(
        `Could not find position for line ${comment.line} in file ${comment.file}`
      );
      return;
    }

    const params = {
      owner,
      repo,
      pull_number: prNumber,
      body: comment.body,
      commit_id: commitSha,
      path: comment.file,
      position,
      side: "RIGHT" as const,
    };

    await octokit.rest.pulls.createReviewComment(params);
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Failed to post line comment: ${error.message}`);
    } else {
      core.warning(`Failed to post line comment: Unknown error`);
    }
  }
}

/**
 * Post a general PR comment
 *
 * @param octokit - Initialized Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param comment - Comment object with body
 */
async function postPrComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  comment: PRComment
): Promise<void> {
  try {
    core.debug("Posting general PR comment");

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment.body,
    });
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Failed to post PR comment: ${error.message}`);
    } else {
      core.warning(`Failed to post PR comment: Unknown error`);
    }
  }
}
