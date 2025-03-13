const core = require('@actions/core');
const axios = require('axios');

/**
 * Analyze a PR diff using an LLM and generate comments
 * 
 * @param {string} diff - The PR diff as a string
 * @param {string} apiKey - API key for the LLM service
 * @param {Object} rules - Configuration rules for comment generation
 * @returns {Promise<Object>} - Analysis results with comments and summary
 */
async function analyzeDiff(diff, apiKey, rules) {
  try {
    core.debug(`Analyzing diff (${diff.length} bytes) with LLM`);

    // Prepare the prompt for the LLM
    const prompt = generatePrompt(diff, rules);

    // Call the LLM API
    const response = await callLlmApi(prompt, apiKey);

    // Parse the LLM response into structured comments
    const analysisResults = parseResponse(response);

    core.debug(`Analysis generated ${analysisResults.comments.length} comments`);
    return analysisResults;
  } catch (error) {
    core.error(`Failed to analyze diff: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a prompt for the LLM based on the diff and rules
 * 
 * @param {string} diff - The PR diff
 * @param {Object} rules - Configuration rules
 * @returns {string} - The formatted prompt
 */
function generatePrompt(diff, rules) {
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
 * Call the LLM API with the prepared prompt
 * 
 * @param {string} prompt - The formatted prompt
 * @param {string} apiKey - API key for the LLM service
 * @returns {Promise<string>} - The LLM response
 */
async function callLlmApi(prompt, apiKey) {
  try {
    // This is a generic implementation - adjust based on your specific LLM API
    const response = await axios.post(
      'https://api.your-llm-provider.com/v1/completions',
      {
        model: 'your-model-name',
        prompt: prompt,
        max_tokens: 2000,
        temperature: 0.3,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: null
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return response.data.choices[0].text.trim();
  } catch (error) {
    core.error(`LLM API call failed: ${error.message}`);
    throw error;
  }
}

/**
 * Parse the LLM response into structured comments
 * 
 * @param {string} response - The raw LLM response
 * @returns {Object} - Structured analysis results
 */
function parseResponse(response) {
  try {
    // Try to parse the response as JSON
    const parsedResponse = JSON.parse(response);

    // Validate the response structure
    if (!parsedResponse.comments || !Array.isArray(parsedResponse.comments)) {
      throw new Error('Invalid response format: missing or invalid comments array');
    }

    if (!parsedResponse.summary) {
      core.warning('Response missing summary field');
      parsedResponse.summary = 'No summary provided';
    }

    // Validate each comment
    parsedResponse.comments = parsedResponse.comments.filter(comment => {
      if (!comment.type || !comment.body) {
        core.warning(`Skipping invalid comment: ${JSON.stringify(comment)}`);
        return false;
      }

      if (comment.type === 'line' && (!comment.file || !comment.line)) {
        core.warning(`Skipping invalid line comment: ${JSON.stringify(comment)}`);
        return false;
      }

      return true;
    });

    return parsedResponse;
  } catch (error) {
    core.error(`Failed to parse LLM response: ${error.message}`);
    // Return a minimal valid structure
    return {
      comments: [],
      summary: `Error parsing LLM response: ${error.message}`
    };
  }
}

module.exports = {
  analyzeDiff
}; 