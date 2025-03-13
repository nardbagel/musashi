#!/bin/bash

# Install dependencies
bun install

# Install type declarations
bun install --save-dev @types/node @types/jest

# Build the project
bun run build 