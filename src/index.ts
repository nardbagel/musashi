import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs";
import * as path from "path";
import { postComments } from "./github/comments";
import {
  getPullRequestContext,
  getPullRequestDiff,
} from "./github/pullRequest";
import { analyzeDiff } from "./llm/analyzer";
import { CommentRules, LLMProvider } from "./types";
import { cloneRepository } from "./utils/git";

/**
 * Main function that runs the GitHub Action
 */
async function run(): Promise<void> {
  try {
    // Get inputs from action configuration
    const token = core.getInput("github-token", { required: true });
    const repoName =
      core.getInput("repo-name") ||
      github.context.repo.owner + "/" + github.context.repo.repo;
    const prNumber = parseInt(
      core.getInput("pr-number", { required: true }),
      10
    );
    const llmApiKey = core.getInput("llm-api-key", { required: true });
    const commentRulesInput = core.getInput("comment-rules") || "{}";
    const logLevel = core.getInput("log-level") || "info";
    const llmProvider = core.getInput("llm-provider") || "openai";
    const llmModel = core.getInput("llm-model") || "";

    // Configure logging based on log level
    configureLogging(logLevel);

    // Initialize GitHub client
    const octokit = github.getOctokit(token);
    const [owner, repo] = repoName.split("/");

    if (!owner || !repo) {
      throw new Error(
        `Invalid repo-name format: ${repoName}. Expected format: owner/repo`
      );
    }

    core.info(`Starting PR analysis for ${repoName}#${prNumber}`);

    // Clone the repository
    const repoPath = await cloneRepository(repoName, token);
    core.info(`Repository cloned to ${repoPath}`);

    // Try to load .musashi file for rules
    let commentRules: CommentRules = {};
    const musashiPath = path.join(repoPath, ".musashi");

    if (fs.existsSync(musashiPath)) {
      try {
        const musashiContent = fs.readFileSync(musashiPath, "utf-8");
        commentRules = JSON.parse(musashiContent) as CommentRules;
        core.info(`Loaded comment rules from .musashi file`);
      } catch (error) {
        core.warning(
          `Failed to parse .musashi file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        // Fall back to input parameter if .musashi file is invalid
        commentRules = JSON.parse(commentRulesInput) as CommentRules;
      }
    } else {
      // Fall back to input parameter if .musashi file doesn't exist
      commentRules = JSON.parse(commentRulesInput) as CommentRules;
      core.debug(`No .musashi file found, using provided comment rules`);
    }

    // Get PR diff
    const diff = await getPullRequestDiff(octokit, owner, repo, prNumber);
    core.info(`Retrieved PR diff (${diff.length} bytes)`);

    // Get PR context (title, description, comments)
    core.debug(`Fetching PR context to enhance analysis`);
    const prContext = await getPullRequestContext(
      octokit,
      owner,
      repo,
      prNumber
    );
    core.info(
      `Retrieved PR context: title, description, and ${prContext.comments.length} comments`
    );

    // Analyze the diff using LLM
    const analysisResults = await analyzeDiff(
      diff,
      llmApiKey,
      commentRules,
      llmProvider as LLMProvider,
      llmModel || undefined,
      prContext
    );
    core.info(
      `Analysis complete: ${analysisResults.comments.length} comments generated`
    );

    // Post comments to the PR
    await postComments(
      octokit,
      owner,
      repo,
      prNumber,
      analysisResults.comments
    );
    core.info("Comments posted successfully");

    core.setOutput("comment-count", analysisResults.comments.length);
    core.setOutput("analysis-summary", analysisResults.summary);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Action failed with error: ${error.message}`);
      if (error.stack) {
        core.debug(error.stack);
      }
    } else {
      core.setFailed(`Action failed with unknown error`);
    }
  }
}

/**
 * Configure logging based on the specified log level
 */
function configureLogging(level: string): void {
  const levels: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  // Set the appropriate log level
  if (levels[level] !== undefined && levels[level] <= levels.debug) {
    core.debug("Debug logging enabled");
  }
}

// Run the action
run();
