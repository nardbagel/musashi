const core = require('@actions/core');
const github = require('@actions/github');
const { cloneRepository } = require('./utils/git');
const { getPullRequestDiff } = require('./github/pullRequest');
const { analyzeDiff } = require('./llm/analyzer');
const { postComments } = require('./github/comments');

/**
 * Main function that runs the GitHub Action
 */
async function run() {
  try {
    // Get inputs from action configuration
    const token = core.getInput('github-token', { required: true });
    const repoName = core.getInput('repo-name', { required: true });
    const prNumber = parseInt(core.getInput('pr-number', { required: true }), 10);
    const llmApiKey = core.getInput('llm-api-key', { required: true });
    const commentRules = JSON.parse(core.getInput('comment-rules') || '{}');
    const logLevel = core.getInput('log-level') || 'info';

    // Configure logging based on log level
    configureLogging(logLevel);

    // Initialize GitHub client
    const octokit = github.getOctokit(token);
    const [owner, repo] = repoName.split('/');

    core.info(`Starting PR analysis for ${repoName}#${prNumber}`);

    // Clone the repository
    const repoPath = await cloneRepository(repoName, token);
    core.info(`Repository cloned to ${repoPath}`);

    // Get PR diff
    const diff = await getPullRequestDiff(octokit, owner, repo, prNumber);
    core.info(`Retrieved PR diff (${diff.length} bytes)`);

    // Analyze the diff using LLM
    const analysisResults = await analyzeDiff(diff, llmApiKey, commentRules);
    core.info(`Analysis complete: ${analysisResults.comments.length} comments generated`);

    // Post comments to the PR
    await postComments(octokit, owner, repo, prNumber, analysisResults.comments);
    core.info('Comments posted successfully');

    core.setOutput('comment-count', analysisResults.comments.length);
    core.setOutput('analysis-summary', analysisResults.summary);

  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
    if (error.stack) {
      core.debug(error.stack);
    }
  }
}

/**
 * Configure logging based on the specified log level
 */
function configureLogging(level) {
  const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  // Set the appropriate log level
  if (levels[level] <= levels.debug) {
    core.debug('Debug logging enabled');
  }
}

// Run the action
run(); 