const core = require('@actions/core');

/**
 * Get the diff for a specific pull request
 * 
 * @param {Object} octokit - Initialized Octokit client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @returns {Promise<string>} - The PR diff as a string
 */
async function getPullRequestDiff(octokit, owner, repo, prNumber) {
  try {
    core.debug(`Fetching diff for PR #${prNumber} in ${owner}/${repo}`);

    // Get the PR details
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: {
        format: 'diff'
      }
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

    return response.data;
  } catch (error) {
    core.error(`Failed to fetch PR diff: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getPullRequestDiff
}; 