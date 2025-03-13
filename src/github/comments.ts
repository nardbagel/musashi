import * as core from '@actions/core';
import { Comment, LineComment, PRComment } from '../types';
import { Octokit } from 'octokit';

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

    // Process each comment
    for (const comment of comments) {
      if (comment.type === 'line') {
        // Post a line comment
        await postLineComment(octokit, owner, repo, prNumber, comment);
      } else if (comment.type === 'pr') {
        // Post a general PR comment
        await postPrComment(octokit, owner, repo, prNumber, comment);
      } else {
        // This should never happen due to type checking, but just in case
        core.warning(`Unknown comment type: ${(comment as any).type}`);
      }
    }

    core.info(`Successfully posted ${comments.length} comments to PR #${prNumber}`);
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
  comment: LineComment
): Promise<void> {
  try {
    core.debug(`Posting line comment to ${comment.file}:${comment.line}`);

    const params: any = {
      owner,
      repo,
      pull_number: prNumber,
      body: comment.body,
      path: comment.file,
      line: comment.line
    };

    // Only add commit_id if it exists
    if (comment.commit_id) {
      params.commit_id = comment.commit_id;
    }

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
    core.debug('Posting general PR comment');

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment.body
    });
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Failed to post PR comment: ${error.message}`);
    } else {
      core.warning(`Failed to post PR comment: Unknown error`);
    }
  }
} 