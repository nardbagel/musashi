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
 * Determine line and side parameters for creating a review comment
 *
 * @param patch - The file patch from GitHub API
 * @param targetLine - The line number to find
 * @returns The line number in the diff and side information
 */
function getLineInfoFromDiff(
  patch: string | undefined,
  targetLine: number
): { line: number; side: "RIGHT" } | null {
  if (!patch) return null;

  const lines = patch.split("\n");
  let currentLine = 0;
  let diffLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a hunk header line
    if (line.startsWith("@@")) {
      // Reset line count at each hunk header
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        // Get the starting line number in the new file for this hunk
        const newStart = parseInt(match[1], 10);
        currentLine = newStart - 1; // Adjust because we'll increment before using
      }
      continue;
    }

    if (line.startsWith("+") || line.startsWith(" ")) {
      currentLine++;
      if (currentLine === targetLine) {
        // Calculate the line number in the diff, factoring in hunk headers
        diffLine = i + 1; // +1 because line numbers are 1-indexed
        return { line: diffLine, side: "RIGHT" };
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

    // Get line and side information
    const lineInfo = getLineInfoFromDiff(patch, comment.line);
    if (!lineInfo) {
      core.warning(
        `Could not find line information for line ${comment.line} in file ${comment.file}`
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
      line: lineInfo.line,
      side: lineInfo.side,
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
