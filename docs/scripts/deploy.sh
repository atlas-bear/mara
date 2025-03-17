#!/bin/bash

# Deployment script for MARA documentation site
echo "Starting deployment process for MARA documentation site..."

# Navigate to the docs directory
cd "$(dirname "$0")/.."

# Build the site
echo "Building the documentation site..."
npm run build

# Deploy to GitHub Pages
echo "Deploying to GitHub Pages..."
GIT_USER=atlas-bear USE_SSH=true npm run deploy

echo "Deployment completed successfully!"
