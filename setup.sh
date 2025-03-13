#!/bin/bash

# Install dependencies
npm install

# Install type declarations
npm install --save-dev @types/node @types/jest

# Build the project
npm run build 