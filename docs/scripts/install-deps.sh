#!/bin/bash

echo "Installing required dependencies for MARA documentation site..."

# Navigate to the docs directory
cd "$(dirname "$0")/.."

# Install dependencies
npm install --save @docusaurus/plugin-ideal-image
npm install --save-dev @docusaurus/module-type-aliases @docusaurus/types

echo "Dependencies installed successfully."
