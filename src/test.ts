import { analyzeDiff } from './llm/analyzer';
import { postComments } from './github/comments';
import { Comment } from './types';

/**
 * Simple test function to verify the GitHub Action works correctly
 * This can be run locally to test the action without deploying it
 */
async function testAction(): Promise<void> {
  try {
    console.log('Starting test of PR Comment Analysis Action');

    // Mock inputs
    const token = process.env.GITHUB_TOKEN;
    const repoName = process.env.REPO_NAME || 'owner/repo';
    const prNumber = parseInt(process.env.PR_NUMBER || '1', 10);
    const llmApiKey = process.env.LLM_API_KEY;

    if (!token || !llmApiKey) {
      throw new Error('Missing required environment variables: GITHUB_TOKEN and LLM_API_KEY');
    }

    console.log(`Testing with repo: ${repoName}, PR: ${prNumber}`);

    // Mock GitHub client (this would normally be initialized with octokit)
    const mockOctokit = {
      rest: {
        pulls: {
          get: async () => ({ data: { title: 'Test PR' } }),
          listFiles: async () => ({ data: [{ filename: 'test.js', status: 'modified' }] }),
          createReviewComment: async (params: any) => {
            console.log(`Would post line comment to ${params.path}:${params.line}`);
            return { data: { id: 123 } };
          }
        },
        issues: {
          createComment: async (params: any) => {
            console.log(`Would post comment to PR: ${params.body.substring(0, 50)}...`);
            return { data: { id: 123 } };
          }
        }
      },
      request: async () => {
        // Mock diff data
        return {
          data: `diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,5 +1,5 @@
 function test() {
-  console.log("Hello world");
+  console.log("Hello world!");
   return true;
 }
`
        };
      }
    };

    // Mock the repository cloning
    console.log('Would clone repository...');

    // Get PR diff
    console.log('Fetching PR diff...');
    const diff = await mockOctokit.request();
    console.log(`Retrieved mock diff (${(diff.data as string).length} bytes)`);

    // Analyze the diff
    console.log('Analyzing diff with LLM...');
    // For testing, we'll use a mock response instead of calling the actual LLM
    const mockAnalysisResults = {
      comments: [
        {
          type: 'line' as const,
          file: 'test.js',
          line: 2,
          body: 'Consider using a template literal instead of concatenation.'
        },
        {
          type: 'pr' as const,
          body: 'Overall this is a minor change that looks good.'
        }
      ],
      summary: 'Minor formatting changes with no functional impact.'
    };

    console.log(`Analysis complete: ${mockAnalysisResults.comments.length} comments generated`);

    // Post comments
    console.log('Posting comments...');
    await postComments(
      mockOctokit,
      repoName.split('/')[0],
      repoName.split('/')[1],
      prNumber,
      mockAnalysisResults.comments
    );

    console.log('Test completed successfully!');
  } catch (error) {
    console.error(`Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAction();
}

export {
  testAction
}; 