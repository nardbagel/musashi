import * as core from '@actions/core';
import axios from 'axios';
import {
  AnalysisResults,
  Comment,
  CommentRules,
  LLMProvider,
  OpenAIResponse,
  AnthropicResponse,
  AxiosError
} from '../types';

/**
 * Analyze a PR diff using an LLM and generate comments
 * 
 * @param diff - The PR diff as a string
 * @param apiKey - API key for the LLM service
 * @param rules - Configuration rules for comment generation
 * @param provider - LLM provider ('openai' or 'anthropic')
 * @param model - Model name to use
 * @returns Analysis results with comments and summary
 */
export async function analyzeDiff(
  diff: string,
  apiKey: string,
  rules: CommentRules,
  provider: LLMProvider = 'openai',
  model?: string
): Promise<AnalysisResults> {
  try {
    core.debug(`Analyzing diff (${diff.length} bytes) with ${provider} LLM`);

    // Prepare the prompt for the LLM
    const prompt = generatePrompt(diff, rules);

    // Call the appropriate LLM API based on provider
    let response: string;
    switch (provider.toLowerCase() as LLMProvider) {
      case 'anthropic':
        response = await callAnthropicApi(prompt, apiKey, model || 'claude-3-7-sonnet-20250219');
        break;
      case 'openai':
        response = await callOpenAIApi(prompt, apiKey, model || 'gpt-4');
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    // Parse the LLM response into structured comments
    const analysisResults = parseResponse(response);

    core.debug(`Analysis generated ${analysisResults.comments.length} comments`);
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
 * Generate a prompt for the LLM based on the diff and rules
 * 
 * @param diff - The PR diff
 * @param rules - Configuration rules
 * @returns The formatted prompt
 */
function generatePrompt(diff: string, rules: CommentRules): string {
  // Create a system prompt that instructs the LLM on how to analyze the code
  const systemPrompt = `
You are a code review assistant. Your task is to analyze the following pull request diff and provide helpful comments.

Please follow these guidelines:
1. Focus on code quality, potential bugs, security issues, and performance concerns
2. Be specific and actionable in your feedback
3. Use a constructive and helpful tone
4. Format your response as JSON with the following structure:
   {
     "comments": [
       {
         "type": "line",  // "line" for file-specific comments, "pr" for general comments
         "file": "path/to/file",  // Only for "line" type
         "line": 42,  // Line number, only for "line" type
         "body": "Your comment text here"
       }
     ],
     "summary": "Brief summary of your overall assessment"
   }

${rules.customInstructions ? `Additional instructions: ${rules.customInstructions}` : ''}
`;

  // Combine the system prompt with the diff
  return `${systemPrompt}\n\nHere is the pull request diff to analyze:\n\n${diff}`;
}

/**
 * Call the OpenAI API with the prepared prompt
 * 
 * @param prompt - The formatted prompt
 * @param apiKey - API key for OpenAI
 * @param model - Model name to use
 * @returns The LLM response
 */
async function callOpenAIApi(prompt: string, apiKey: string, model: string): Promise<string> {
  try {
    core.debug(`Calling OpenAI API with model: ${model}`);

    const response = await axios.post<OpenAIResponse>(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a code review assistant that analyzes PR diffs and provides helpful comments."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI API');
    }

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    if (error instanceof Error) {
      core.error(`OpenAI API call failed: ${error.message}`);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          core.error(`Status: ${axiosError.response.status}, Data: ${JSON.stringify(axiosError.response.data)}`);
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
 * 
 * @param prompt - The formatted prompt
 * @param apiKey - API key for Anthropic
 * @param model - Model name to use
 * @returns The LLM response
 */
async function callAnthropicApi(prompt: string, apiKey: string, model: string): Promise<string> {
  try {
    core.debug(`Calling Anthropic API with model: ${model}`);

    const response = await axios.post<AnthropicResponse>(
      'https://api.anthropic.com/v1/messages',
      {
        model: model,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    if (!response.data.content || !response.data.content[0] || !response.data.content[0].text) {
      throw new Error('Invalid response format from Anthropic API');
    }

    return response.data.content[0].text;
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Anthropic API call failed: ${error.message}`);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          core.error(`Status: ${axiosError.response.status}, Data: ${JSON.stringify(axiosError.response.data)}`);
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
 * 
 * @param response - The raw LLM response
 * @returns Structured analysis results
 */
function parseResponse(response: string): AnalysisResults {
  try {
    // Try to parse the response as JSON
    const parsedResponse = JSON.parse(response) as Partial<AnalysisResults>;

    // Validate the response structure
    if (!parsedResponse.comments || !Array.isArray(parsedResponse.comments)) {
      throw new Error('Invalid response format: missing or invalid comments array');
    }

    if (!parsedResponse.summary) {
      core.warning('Response missing summary field');
      parsedResponse.summary = 'No summary provided';
    }

    // Validate each comment
    const validComments: Comment[] = [];

    for (const comment of parsedResponse.comments as Array<any>) {
      // Check if comment has required fields
      if (!comment.type || !comment.body) {
        core.warning(`Skipping invalid comment: ${JSON.stringify(comment)}`);
        continue;
      }

      // Validate line comments
      if (comment.type === 'line') {
        if (!('file' in comment) || !('line' in comment)) {
          core.warning(`Skipping invalid line comment: ${JSON.stringify(comment)}`);
          continue;
        }

        validComments.push({
          type: 'line',
          file: comment.file as string,
          line: comment.line as number,
          body: comment.body,
          commit_id: 'commit_id' in comment ? (comment.commit_id as string) : undefined
        });
      }
      // Validate PR comments
      else if (comment.type === 'pr') {
        validComments.push({
          type: 'pr',
          body: comment.body
        });
      }
      // Skip unknown comment types
      else {
        core.warning(`Skipping comment with unknown type: ${comment.type}`);
      }
    }

    return {
      comments: validComments,
      summary: parsedResponse.summary || 'No summary provided'
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
      summary: `Error parsing LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
} 