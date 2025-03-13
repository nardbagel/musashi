import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import * as os from 'os';

/**
 * Clone the target repository to a temporary directory
 * 
 * @param repoName - Repository name in format 'owner/repo'
 * @param token - GitHub token for authentication
 * @returns Path to the cloned repository
 */
export async function cloneRepository(repoName: string, token: string): Promise<string> {
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
    if (error instanceof Error) {
      core.error(`Failed to clone repository: ${error.message}`);
    } else {
      core.error(`Failed to clone repository: Unknown error`);
    }
    throw error;
  }
} 