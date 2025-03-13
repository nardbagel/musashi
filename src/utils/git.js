const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const os = require('os');

/**
 * Clone the target repository to a temporary directory
 * 
 * @param {string} repoName - Repository name in format 'owner/repo'
 * @param {string} token - GitHub token for authentication
 * @returns {Promise<string>} - Path to the cloned repository
 */
async function cloneRepository(repoName, token) {
  try {
    // Create a temporary directory for the repository
    const tempDir = path.join(os.tmpdir(), `pr-analysis-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Format the repository URL with authentication token
    const [owner, repo] = repoName.split('/');
    const repoUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;

    // Initialize git and clone the repository
    const git = simpleGit();
    core.debug(`Cloning repository ${repoName} to ${tempDir}`);
    await git.clone(repoUrl, tempDir);

    return tempDir;
  } catch (error) {
    core.error(`Failed to clone repository: ${error.message}`);
    throw error;
  }
}

module.exports = {
  cloneRepository
}; 