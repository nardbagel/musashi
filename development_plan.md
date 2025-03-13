# Development Plan: GitHub Action for PR Comments 

## Goals
- Use the Goose AI agent to automate creation of a GitHub Action
- The Action should download a repo, analyze the diff in a PR, and add relevant comments
- Minimize direct coding by leveraging Goose's capabilities 

## Research and Design
- [x] Evaluate Goose features and extensibility model
   - [x] Understand how to customize with our LLM and GitHub API
   - [x] Map out which parts can be automated vs require direct code
- [x] Design the GitHub Action architecture 
   - [x] Outline the key steps: clone repo, get context, analyze PR diff, log comments
   - [x] Determine config options: target repo/PR, credentials, comment rules, logging
   - [x] Decide how Goose integrates into the Action flow
- [x] Identify any dependencies or constraints  
   - [x] GitHub API client library to use
   - [x] Credential management approach
   - [x] Execution environment requirements

## Implementation  
- [x] Configure Goose agent
   - [x] Provide prompt engineering to describe the task
   - [x] Connect to LLM and GitHub API
   - [x] Implement core logic to analyze diff and generate comments
- [x] Develop GitHub Action shell
   - [x] Set up config parsing and validation
   - [x] Invoke Goose to perform the automated steps
   - [x] Handle cloning the repo and pushing comments
- [ ] Test and iterate
   - [ ] Trial run on sample repos and PRs
   - [ ] Debug and refine Goose prompts as needed
   - [ ] Verify comments are appropriate and useful

## Deployment
- [ ] Package GitHub Action 
   - [x] Document configuration and usage
   - [ ] Publish to GitHub Marketplace
- [ ] Integrate into our CI/CD pipelines
   - [ ] Add as a required check on PRs
   - [ ] Configure for our key repositories 
