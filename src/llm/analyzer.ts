import * as core from "@actions/core";
import axios from "axios";
import micromatch from "micromatch";
import { PRContext } from "../github/pullRequest";
import {
  AnalysisResults,
  AnthropicResponse,
  AxiosError,
  Comment,
  CommentRules,
  LLMProvider,
  OpenAIResponse,
} from "../types";
import { ROOT_PROMPT } from "./rootPrompt";

/**
 * Analyze a PR diff using an LLM and generate comments
 *
 * @param diff - The PR diff as a string
 * @param apiKey - API key for the LLM service
 * @param rules - Configuration rules for comment generation
 * @param provider - LLM provider ('openai' or 'anthropic')
 * @param model - Model name to use
 * @param prContext - Pull request context including existing comments
 * @param excludeFiles - List of files to exclude from analysis
 * @returns Analysis results with comments and summary
 */
export async function analyzeDiff(
  diff: string,
  apiKey: string,
  rules: CommentRules,
  provider: LLMProvider = "openai",
  model?: string,
  prContext?: PRContext,
  excludeFiles: string[] = []
): Promise<AnalysisResults> {
  try {
    core.debug(`Analyzing diff (${diff.length} bytes) with ${provider} LLM`);

    // Always exclude .musashi file
    const allExcludePatterns = [".musashi", ...excludeFiles];
    core.debug(
      `Excluding files matching patterns: ${allExcludePatterns.join(", ")}`
    );

    // Filter out excluded files from the diff
    if (allExcludePatterns.length > 0) {
      diff = filterDiffByExcludePatterns(diff, allExcludePatterns);
      core.debug(`Filtered diff to ${diff.length} bytes after excluding files`);
    }

    // Format the diff with line numbers before creating the prompt
    const formattedDiff = formatDiffWithLineNumbers(diff);
    const prompt = generatePrompt(formattedDiff, rules, prContext);

    // Call the appropriate LLM API based on provider
    let response: string;
    switch (provider.toLowerCase() as LLMProvider) {
      case "anthropic":
        response = await callAnthropicApi(
          prompt,
          apiKey,
          model || "claude-3-7-sonnet-20250219"
        );
        break;
      case "openai":
        response = await callOpenAIApi(prompt, apiKey, model || "gpt-4o-mini");
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    // Parse the LLM response into structured comments
    const analysisResults = parseResponse(response);

    // Filter out comments for excluded files
    if (allExcludePatterns.length > 0) {
      analysisResults.comments = filterCommentsByExcludePatterns(
        analysisResults.comments,
        allExcludePatterns
      );
      core.debug(
        `Filtered to ${analysisResults.comments.length} comments after excluding files`
      );
    }

    core.debug(
      `Analysis generated ${analysisResults.comments.length} comments`
    );
    return analysisResults;
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Failed to analyze diff: ${error.message}`);
    } else {
      core.error(`Failed to analyze diff: Unknown error`);
    }
    throw error;
  }
}

/**
 * Filter the diff to exclude files matching the exclude patterns
 */
function filterDiffByExcludePatterns(
  diff: string,
  excludePatterns: string[]
): string {
  // Split the diff into sections by file
  const diffSections = diff.split("diff --git ");
  const filteredSections: string[] = [];

  // Skip the first empty section if it exists
  const sectionsToProcess = diffSections[0]
    ? diffSections
    : diffSections.slice(1);

  for (const section of sectionsToProcess) {
    if (!section.trim()) continue;

    // Add the "diff --git " prefix back for all non-empty sections except the first
    // which might be a header
    const processedSection =
      section === diffSections[0] && !diff.startsWith("diff --git ")
        ? section
        : "diff --git " + section;

    // Extract the file path from the diff section
    const filePathMatch = processedSection.match(/diff --git a\/(.*?) b\//);
    if (!filePathMatch) continue;

    const filePath = filePathMatch[1];

    // Skip if the file matches any exclude pattern
    if (!micromatch.isMatch(filePath, excludePatterns)) {
      filteredSections.push(processedSection);
    }
  }

  return filteredSections.join("");
}

/**
 * Filter comments to exclude those for files matching the exclude patterns
 */
function filterCommentsByExcludePatterns(
  comments: Comment[],
  excludePatterns: string[]
): Comment[] {
  return comments.filter((comment) => {
    // Keep PR-level comments
    if (comment.type !== "line") return true;

    // For line comments, check if the file matches any exclude pattern
    return !micromatch.isMatch(comment.file, excludePatterns);
  });
}

/**
 * Generate a prompt for the LLM based on the diff and rules
 *
 * @param diff - The PR diff
 * @param rules - Configuration rules
 * @param prContext - Pull request context including existing comments
 * @returns The formatted prompt
 */
function generatePrompt(
  diff: string,
  rules: CommentRules,
  prContext?: PRContext
): string {
  // Create a system prompt that instructs the LLM on how to analyze the code
  const systemPrompt = `
${ROOT_PROMPT}

${
  rules
    ? `Additional instructions specific to doing PR reviews in this git repository: ${rules}`
    : ""
}
`;

  // Add PR context if available
  let prContextText = "";
  if (prContext) {
    prContextText = `
## Pull Request Information
Title: ${prContext.title}

Description:
${prContext.description}

${
  prContext.existingComments.lineComments.length > 0
    ? `
## Relevant Comments:
${prContext.existingComments.lineComments.join("\n\n")}
`
    : ""
}

Use this context to better understand the author's intentions, but focus your comments on the code changes.
`;
  }

  // Combine the system prompt with context and diff
  return `${systemPrompt}
${prContextText}
Here is the pull request diff to analyze:

${diff}`;
}

/**
 * Call the OpenAI API with the prepared prompt
 *
 * @param prompt - The formatted prompt
 * @param apiKey - API key for OpenAI
 * @param model - Model name to use
 * @returns The LLM response
 */
async function callOpenAIApi(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  try {
    core.debug(`Calling OpenAI API with model: ${model}`);

    const response = await axios.post<OpenAIResponse>(
      "https://api.openai.com/v1/chat/completions",
      {
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You are a code review assistant that analyzes PR diffs and provides helpful comments.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (
      !response.data.choices ||
      !response.data.choices[0] ||
      !response.data.choices[0].message
    ) {
      throw new Error("Invalid response format from OpenAI API");
    }

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    if (error instanceof Error) {
      core.error(`OpenAI API call failed: ${error.message}`);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          core.error(
            `Status: ${axiosError.response.status}, Data: ${JSON.stringify(
              axiosError.response.data
            )}`
          );
        }
      }
    } else {
      core.error(`OpenAI API call failed: Unknown error`);
    }
    throw error;
  }
}

/**
 * Call the Anthropic API with the prepared prompt
 */
async function callAnthropicApi(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  try {
    core.debug(`Calling Anthropic API with model: ${model}`);

    const response = await axios.post<AnthropicResponse>(
      "https://api.anthropic.com/v1/messages",
      {
        model: model,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      }
    );

    if (
      !response.data.content ||
      !response.data.content[0] ||
      !response.data.content[0].text
    ) {
      throw new Error("Invalid response format from Anthropic API");
    }

    return response.data.content[0].text;
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Anthropic API call failed: ${error.message}`);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          core.error(
            `Status: ${axiosError.response.status}, Data: ${JSON.stringify(
              axiosError.response.data
            )}`
          );
        }
      }
    } else {
      core.error(`Anthropic API call failed: Unknown error`);
    }
    throw error;
  }
}

/**
 * Parse the LLM response into structured comments
 */
function parseResponse(response: string): AnalysisResults {
  try {
    // Clean up the response - remove markdown code blocks if present
    let cleanedResponse = response;

    // Remove markdown code blocks if present (```json ... ```)
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleanedResponse = codeBlockMatch[1];
    }

    // Try to parse the response as JSON
    const parsedResponse = JSON.parse(
      cleanedResponse
    ) as Partial<AnalysisResults>;

    // Validate the response structure
    if (!parsedResponse.comments || !Array.isArray(parsedResponse.comments)) {
      throw new Error(
        "Invalid response format: missing or invalid comments array"
      );
    }

    if (!parsedResponse.summary) {
      core.warning("Response missing summary field");
      parsedResponse.summary = "No summary provided";
    }

    // Validate each comment
    const validComments: Comment[] = [];

    for (const comment of parsedResponse.comments as Array<any>) {
      // Check if comment has required fields
      if (!comment.type || !comment.body) {
        core.warning(
          `Skipping invalid comment due to missing required fields.`
        );
        continue;
      }

      // Validate line comments
      if (comment.type === "line") {
        if (!("file" in comment) || !("line" in comment)) {
          core.warning(
            `Skipping invalid line comment due to missing file or line.`
          );
          continue;
        }

        validComments.push({
          type: "line",
          file: comment.file as string,
          line: comment.line as number,
          body: comment.body,
          commit_id:
            "commit_id" in comment ? (comment.commit_id as string) : undefined,
        });
      }
      // Validate PR comments
      else if (comment.type === "pr") {
        validComments.push({
          type: "pr",
          body: comment.body,
        });
      }
      // Skip unknown comment types
      else {
        core.warning(`Skipping comment with unknown type.`);
      }
    }

    return {
      comments: validComments,
      summary: parsedResponse.summary || "No summary provided",
    };
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Failed to parse LLM response: ${error.message}`);
    } else {
      core.error(`Failed to parse LLM response: Unknown error`);
    }
    // Return a minimal valid structure
    return {
      comments: [],
      summary: `Error parsing LLM response: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

function formatDiffWithLineNumbers(diff: string): string {
  const lines = diff.split("\n");
  const result: string[] = [];

  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const hunkHeaderMatch = /^@@ -(\d+),?\d* \+(\d+),?\d* @@/.exec(line);
    if (hunkHeaderMatch) {
      oldLine = parseInt(hunkHeaderMatch[1], 10);
      newLine = parseInt(hunkHeaderMatch[2], 10);
      continue;
    }

    if (line.startsWith(" ")) {
      result.push(` [${oldLine}] ${line.slice(1)}`);
      oldLine++;
      newLine++;
    } else if (line.startsWith("-")) {
      result.push(`-[${oldLine}] ${line.slice(1)}`);
      oldLine++;
    } else if (line.startsWith("+")) {
      result.push(`+[${newLine}] ${line.slice(1)}`);
      newLine++;
    }
  }

  return result.join("\n");
}
