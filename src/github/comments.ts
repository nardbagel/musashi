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

interface DiffLineInfo {
  line: number;
  side: "LEFT" | "RIGHT";
}

function getLineInfoFromDiff(
  patch: string | undefined,
  targetLine: number
): DiffLineInfo | null {
  if (!patch) return null;

  const lines = patch.split("\n");
  let currentLine = 0;
  let diffLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        currentLine = parseInt(match[1], 10) - 1;
      }
      continue;
    }

    // Now we check both + and - lines
    if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
      currentLine++;
      if (currentLine === targetLine) {
        diffLine = i + 1;
        // Determine side based on the line prefix
        const side = line.startsWith("-") ? "LEFT" : "RIGHT";
        return { line: diffLine, side };
      }
    }
  }

  return null;
}

/**
 * Validate that a line number exists in the diff and is part of a change
 */
function validateLineInDiff(
  patch: string | undefined,
  targetLine: number
): { isValid: boolean; codeLine?: string } {
  if (!patch) return { isValid: false };

  const lines = patch.split("\n");
  let currentLine = 0;
  let foundLine: string | undefined;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        currentLine = parseInt(match[1], 10) - 1;
      }
      continue;
    }

    if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
      currentLine++;
      if (currentLine === targetLine) {
        foundLine = line;
        if (line.startsWith("+") || line.startsWith("-")) {
          return { isValid: true, codeLine: line };
        }
      }
    }
  }

  return { isValid: false, codeLine: foundLine };
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
  const params: {
    owner: string;
    repo: string;
    pull_number: number;
    body: string;
    commit_id: string;
    path: string;
    line: number;
    side: "RIGHT";
  } = {
    owner,
    repo,
    pull_number: prNumber,
    body: comment.body,
    commit_id: commitSha,
    path: comment.file,
    line: 0,
    side: "RIGHT",
  };

  try {
    core.debug(`Posting line comment to ${comment.file}:${comment.line}`);

    // First validate that the line exists in the diff and is a changed line
    const validation = validateLineInDiff(patch, comment.line);
    if (!validation.isValid) {
      core.info(
        `Skipping comment for ${comment.file}:${
          comment.line
        } - line is not changed in the diff\nLine content: ${
          validation.codeLine || "Line not found in diff"
        }`
      );
      return;
    }

    // Get line and side information
    const lineInfo = getLineInfoFromDiff(patch, comment.line);
    if (!lineInfo) {
      core.info(
        `Skipping comment for ${comment.file}:${
          comment.line
        } - could not map to diff line\nLine content: ${
          validation.codeLine || "Line not found in diff"
        }`
      );
      return;
    }

    params.line = lineInfo.line;
    await octokit.rest.pulls.createReviewComment(params);
  } catch (error) {
    if (error instanceof Error) {
      core.warning(
        `Failed to post line comment: ${
          error.message
        }\nParams: ${JSON.stringify(params, null, 2)}`
      );
    } else {
      core.warning(
        `Failed to post line comment: Unknown error\nParams: ${JSON.stringify(
          params,
          null,
          2
        )}`
      );
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
