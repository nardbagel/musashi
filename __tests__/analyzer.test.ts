import axios from "axios";
import { analyzeDiff } from "../src/llm/analyzer";
import { CommentRules, LLMProvider } from "../src/types";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("LLM Analyzer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("analyzeDiff should process diff with OpenAI and return structured comments", async () => {
    // Mock the axios response for OpenAI
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                comments: [
                  {
                    type: "line",
                    file: "test.js",
                    line: 2,
                    body: "Consider using a template literal instead of concatenation.",
                  },
                  {
                    type: "pr",
                    body: "Overall this is a minor change that looks good.",
                  },
                ],
                summary: "Minor formatting changes with no functional impact.",
              }),
            },
          },
        ],
      },
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
    const apiKey = "test-api-key";
    const rules: CommentRules = "Focus on code quality";

    // Call the function with OpenAI provider
    const result = await analyzeDiff(diff, apiKey, rules, "openai", "gpt-4");

    // Verify the result
    expect(result).toHaveProperty("comments");
    expect(result).toHaveProperty("summary");
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].type).toBe("line");
    if (result.comments[0].type === "line") {
      expect(result.comments[0].file).toBe("test.js");
      expect(result.comments[0].line).toBe(2);
    }
    expect(result.comments[1].type).toBe("pr");

    // Verify axios was called correctly for OpenAI
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post.mock.calls[0][0]).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
    expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty("model", "gpt-4");
    expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty("messages");
    expect(mockedAxios.post.mock.calls[0][2]?.headers).toHaveProperty(
      "Authorization",
      "Bearer test-api-key"
    );
  });

  test("analyzeDiff should process diff with Anthropic and return structured comments", async () => {
    // Mock the axios response for Anthropic
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        content: [
          {
            text: JSON.stringify({
              comments: [
                {
                  type: "line",
                  file: "test.js",
                  line: 2,
                  body: "Consider using a template literal instead of concatenation.",
                },
                {
                  type: "pr",
                  body: "Overall this is a minor change that looks good.",
                },
              ],
              summary: "Minor formatting changes with no functional impact.",
            }),
          },
        ],
      },
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
    const apiKey = "test-api-key";
    const rules: CommentRules = "Focus on code quality";

    // Call the function with Anthropic provider
    const result = await analyzeDiff(
      diff,
      apiKey,
      rules,
      "anthropic",
      "claude-3-7-sonnet-20250219"
    );

    // Verify the result
    expect(result).toHaveProperty("comments");
    expect(result).toHaveProperty("summary");
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].type).toBe("line");
    if (result.comments[0].type === "line") {
      expect(result.comments[0].file).toBe("test.js");
      expect(result.comments[0].line).toBe(2);
    }
    expect(result.comments[1].type).toBe("pr");

    // Verify axios was called correctly for Anthropic
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post.mock.calls[0][0]).toBe(
      "https://api.anthropic.com/v1/messages"
    );
    expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty(
      "model",
      "claude-3-7-sonnet-20250219"
    );
    expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty("messages");
    expect(mockedAxios.post.mock.calls[0][2]?.headers).toHaveProperty(
      "x-api-key",
      "test-api-key"
    );
    expect(mockedAxios.post.mock.calls[0][2]?.headers).toHaveProperty(
      "anthropic-version",
      "2023-06-01"
    );
  });

  test("analyzeDiff should handle invalid provider", async () => {
    // Sample diff, API key, and rules
    const diff = "sample diff";
    const apiKey = "test-api-key";
    const rules: CommentRules = "";

    // Call the function with invalid provider and expect it to throw
    await expect(
      analyzeDiff(diff, apiKey, rules, "invalid-provider" as LLMProvider)
    ).rejects.toThrow("Unsupported LLM provider: invalid-provider");
  });

  test("analyzeDiff should exclude files matching patterns", async () => {
    // Mock the axios response for OpenAI
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                comments: [
                  {
                    type: "line",
                    file: "test.js",
                    line: 2,
                    body: "Comment 1",
                  },
                  {
                    type: "line",
                    file: "docs/README.md",
                    line: 1,
                    body: "Comment 2",
                  },
                  {
                    type: "pr",
                    body: "General comment",
                  },
                ],
                summary: "Test summary",
              }),
            },
          },
        ],
      },
    });

    // Sample diff with multiple files
    const diff = `diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,1 +1,1 @@
-old
+new
diff --git a/docs/README.md b/docs/README.md
index 8901234..5678901 100644
--- a/docs/README.md
+++ b/docs/README.md
@@ -1,1 +1,1 @@
-# Old title
+# New title`;

    const apiKey = "test-api-key";
    const rules: CommentRules = "";
    const excludeFiles = ["*.md", "docs/**/*"];

    // Call the function with exclude patterns
    const result = await analyzeDiff(
      diff,
      apiKey,
      rules,
      "openai",
      undefined,
      undefined,
      excludeFiles
    );

    // Verify that markdown files were excluded
    expect(result.comments).toHaveLength(2); // 1 line comment + 1 PR comment
    expect(result.comments[0].type).toBe("line");
    if (result.comments[0].type === "line") {
      expect(result.comments[0].file).toBe("test.js");
    }
    expect(result.comments[1].type).toBe("pr");
  });
});
