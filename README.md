# PR Comment Analysis GitHub Action

This GitHub Action analyzes pull request diffs using an LLM (Large Language Model) and automatically adds relevant comments to the PR. It helps improve code quality by providing automated code review feedback.

## Features

- Analyzes PR diffs using an LLM
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
      - name: Analyze PR
        uses: your-org/pr-comment-analysis@v1
        with:
          github-token: ${{ secrets.MUSASHI }}
          repo-name: ${{ github.repository }}
          pr-number: ${{ github.event.pull_request.number }}
          llm-api-key: ${{ secrets.LLM_API_KEY }}
          comment-rules: |
            {
              "customInstructions": "Focus on security issues and performance improvements"
            }
          log-level: "info"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | N/A |
| `repo-name` | Target repository name (owner/repo) | Yes | N/A |
| `pr-number` | Pull request number to analyze | Yes | N/A |
| `llm-api-key` | API key for the LLM service | Yes | N/A |
| `comment-rules` | JSON configuration for comment rules | No | `{}` |
| `log-level` | Logging level (debug, info, warn, error) | No | `info` |

## Outputs

| Output | Description |
|--------|-------------|
| `comment-count` | Number of comments posted |
| `analysis-summary` | Summary of the analysis |

## Comment Rules

You can customize the behavior of the LLM by providing a JSON object with the following properties:

```json
{
  "customInstructions": "Additional instructions for the LLM"
}
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