# PR Comment Analysis GitHub Action

This GitHub Action analyzes pull request diffs using an LLM (Large Language Model) and automatically adds relevant comments to the PR. It helps improve code quality by providing automated code review feedback.

## Features

- Analyzes PR diffs using an LLM
- Considers PR context (title, description, and comments) to better understand intent
- Posts line-specific comments on code that could be improved
- Provides a summary comment of the overall PR
- Configurable rules for comment generation
- Works with any GitHub repository

## Usage

Add this action to your workflow file:

```yaml
name: PR Analysis

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Analyze PR
        uses: your-org/pr-comment-analysis@v1
        with:
          github-token: ${{ secrets.MUSASHI }}
          # repo-name defaults to the current repository
          pr-number: ${{ github.event.pull_request.number }}
          llm-api-key: ${{ secrets.LLM_API_KEY }}
          # Comment rules will be read from .musashi file if it exists
          log-level: "info"
```

You can configure the LLM behavior by adding a `.musashi` file to the root of your repository:

```
"Focus on security issues and performance improvements"
```

## Inputs

| Input           | Description                                                               | Required | Default                    |
| --------------- | ------------------------------------------------------------------------- | -------- | -------------------------- |
| `github-token`  | GitHub token for API access                                               | Yes      | N/A                        |
| `repo-name`     | Target repository name (owner/repo)                                       | No       | `${{ github.repository }}` |
| `pr-number`     | Pull request number to analyze                                            | Yes      | N/A                        |
| `llm-api-key`   | API key for the LLM service                                               | Yes      | N/A                        |
| `comment-rules` | JSON configuration for comment rules (fallback if .musashi doesn't exist) | No       | `{}`                       |
| `log-level`     | Logging level (debug, info, warn, error)                                  | No       | `info`                     |
| `llm-provider`  | LLM provider to use (openai or anthropic)                                 | No       | `openai`                   |
| `llm-model`     | Specific model to use                                                     | No       | provider default           |

## Configuration

### Using a .musashi File

You can configure the action by adding a `.musashi` file to the root of your repository. This file takes precedence over the `comment-rules` input parameter.

Example `.musashi` file:

```
Focus on security issues, performance improvements, and adherence to TypeScript best practices

```

If the `.musashi` file is not found or cannot be parsed, the action will fall back to using the `comment-rules` input parameter.

## Outputs

| Output             | Description               |
| ------------------ | ------------------------- |
| `comment-count`    | Number of comments posted |
| `analysis-summary` | Summary of the analysis   |

## Comment Rules

You can customize the behavior of the LLM by providing a JSON object with the following properties:

```
Additional instructions for the LLM
```

## Development

### Prerequisites

- bun
- TypeScript knowledge

### Setup

1. Clone the repository
2. Install dependencies: `bun install`
3. Build the action: `bun build`

### TypeScript Development

This project is built with TypeScript for improved type safety and developer experience. The TypeScript configuration is in `tsconfig.json`.

To check types without building:

```
bun typecheck
```

To build the TypeScript code:

```
bun build
```

### Testing

Run tests with: `bun test`

For manual testing, you can use:

```
bun test:manual
```

## License

MIT
