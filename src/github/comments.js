const core = require('@actions/core');

/**
 * Post comments to a pull request
 * 
 * @param {Object} octokit - Initialized Octokit client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @param {Array<Object>} comments - Array of comment objects to post
 * @returns {Promise<void>}
 */
async function postComments(octokit, owner, repo, prNumber, comments) {
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
        core.warning(`Unknown comment type: ${comment.type}`);
      }
    }

    core.info(`Successfully posted ${comments.length} comments to PR #${prNumber}`);
  } catch (error) {
    core.error(`Failed to post comments: ${error.message}`);
    throw error;
  }
}

/**
 * Post a line-specific comment
 * 
 * @param {Object} octokit - Initialized Octokit client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @param {Object} comment - Comment object with file, line, and body
 * @returns {Promise<void>}
 */
async function postLineComment(octokit, owner, repo, prNumber, comment) {
  try {
    core.debug(`Posting line comment to ${comment.file}:${comment.line}`);

    await octokit.rest.pulls.createReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      body: comment.body,
      commit_id: comment.commit_id,
      path: comment.file,
      line: comment.line
    });
  } catch (error) {
    core.warning(`Failed to post line comment: ${error.message}`);
  }
}

/**
 * Post a general PR comment
 * 
 * @param {Object} octokit - Initialized Octokit client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @param {Object} comment - Comment object with body
 * @returns {Promise<void>}
 */
async function postPrComment(octokit, owner, repo, prNumber, comment) {
  try {
    core.debug('Posting general PR comment');

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment.body
    });
  } catch (error) {
    core.warning(`Failed to post PR comment: ${error.message}`);
  }
}

module.exports = {
  postComments
}; 