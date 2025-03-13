const { analyzeDiff } = require('../src/llm/analyzer');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('LLM Analyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('analyzeDiff should process diff and return structured comments', async () => {
    // Mock the axios response
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            text: JSON.stringify({
              comments: [
                {
                  type: 'line',
                  file: 'test.js',
                  line: 2,
                  body: 'Consider using a template literal instead of concatenation.'
                },
                {
                  type: 'pr',
                  body: 'Overall this is a minor change that looks good.'
                }
              ],
              summary: 'Minor formatting changes with no functional impact.'
            })
          }
        ]
      }
    });

    // Sample diff
    const diff = `diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,5 +1,5 @@
 function test() {
-  console.log("Hello world");
+  console.log("Hello world!");
   return true;
 }
`;

    // Sample API key and rules
    const apiKey = 'test-api-key';
    const rules = { customInstructions: 'Focus on code quality' };

    // Call the function
    const result = await analyzeDiff(diff, apiKey, rules);

    // Verify the result
    expect(result).toHaveProperty('comments');
    expect(result).toHaveProperty('summary');
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].type).toBe('line');
    expect(result.comments[0].file).toBe('test.js');
    expect(result.comments[0].line).toBe(2);
    expect(result.comments[1].type).toBe('pr');

    // Verify axios was called correctly
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain('api.your-llm-provider.com');
    expect(axios.post.mock.calls[0][1]).toHaveProperty('prompt');
    expect(axios.post.mock.calls[0][1].prompt).toContain('Focus on code quality');
    expect(axios.post.mock.calls[0][2].headers).toHaveProperty('Authorization', 'Bearer test-api-key');
  });

  test('analyzeDiff should handle invalid LLM responses', async () => {
    // Mock an invalid response
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            text: 'This is not valid JSON'
          }
        ]
      }
    });

    // Call the function
    const result = await analyzeDiff('sample diff', 'test-api-key', {});

    // Verify the result has an empty comments array and error summary
    expect(result).toHaveProperty('comments');
    expect(result.comments).toHaveLength(0);
    expect(result).toHaveProperty('summary');
    expect(result.summary).toContain('Error parsing LLM response');
  });
}); 