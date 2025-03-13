#!/bin/bash

# Install Bun if not already installed
if ! command -v bun &> /dev/null; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
fi

# Install dependencies
bun install

# Build the project
bun run build