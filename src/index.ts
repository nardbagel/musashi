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
 * Process @references in rule content by replacing them with file contents
 */
function processReferences(content: string, basePath: string): string {
  const referenceRegex = /@([^\s\n]+)/g;

  return content.replace(referenceRegex, (match, relativePath) => {
    try {
      const fullPath = path.resolve(basePath, relativePath);

      // Security check: ensure the resolved path is within the repository
      if (!fullPath.startsWith(basePath)) {
        core.warning(
          `Skipping reference ${relativePath}: path outside repository`
        );
        return match;
      }

      if (fs.existsSync(fullPath)) {
        const referencedContent = fs.readFileSync(fullPath, "utf-8");
        core.debug(`Resolved reference ${relativePath}`);
        return referencedContent;
      } else {
        core.warning(`Referenced file not found: ${relativePath}`);
        return match;
      }
    } catch (error) {
      core.warning(
        `Failed to resolve reference ${relativePath}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return match;
    }
  });
}

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
    const commentRulesInput = core.getInput("comment-rules") || "";
    const logLevel = core.getInput("log-level") || "info";
    const llmProvider = core.getInput("llm-provider") || "openai";
    const llmModel = core.getInput("llm-model") || "";
    const excludeFiles = core
      .getInput("exclude-files")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

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

    // Try to load .cursor/rules/*.mdc files for rules
    let commentRules: CommentRules = "";
    const cursorRulesPath = path.join(repoPath, ".cursor", "rules");

    if (fs.existsSync(cursorRulesPath)) {
      try {
        const mdcFiles = fs
          .readdirSync(cursorRulesPath)
          .filter((file) => file.endsWith(".mdc"))
          .sort(); // Sort for consistent ordering

        if (mdcFiles.length > 0) {
          const ruleContents = mdcFiles.map((file) => {
            const filePath = path.join(cursorRulesPath, file);
            const content = fs.readFileSync(filePath, "utf-8");
            const processedContent = processReferences(content, repoPath);
            return `# Rules from ${file}\n${processedContent}`;
          });

          commentRules = ruleContents.join("\n\n");
          core.info(
            `Loaded comment rules from ${
              mdcFiles.length
            } .mdc files: ${mdcFiles.join(", ")}`
          );
        } else {
          core.debug(`No .mdc files found in .cursor/rules directory`);
          commentRules = commentRulesInput;
        }
      } catch (error) {
        core.warning(
          `Failed to read .cursor/rules/*.mdc files: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        // Fall back to input parameter if .cursor/rules files are invalid
        commentRules = commentRulesInput;
      }
    } else {
      // Fall back to input parameter if .cursor/rules directory doesn't exist
      commentRules = commentRulesInput;
      core.debug(
        `No .cursor/rules directory found, using provided comment rules`
      );
    }

    // Get PR context and diff
    const [prContext, diff] = await Promise.all([
      getPullRequestContext(octokit, owner, repo, prNumber),
      getPullRequestDiff(octokit, owner, repo, prNumber),
    ]);
    core.info(`Retrieved PR context and diff (${diff.length} bytes)`);
    core.debug(
      `Found ${prContext.existingComments.lineComments.length} line comments and ${prContext.existingComments.prComments.length} PR comments`
    );

    // Analyze the diff using LLM
    const analysisResults = await analyzeDiff(
      diff,
      llmApiKey,
      commentRules,
      llmProvider as LLMProvider,
      llmModel || undefined,
      prContext,
      excludeFiles
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
