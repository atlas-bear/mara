#!/bin/bash

# Create the necessary directories if they don't exist
mkdir -p static/img

# Copy the texture images
echo "Copying texture images..."
cp src/img/paper-texture-light.png static/img/
cp src/img/paper-texture-dark.png static/img/
cp src/img/hero-illustration.svg static/img/
cp src/img/mara_logo.svg static/img/
cp src/img/mara-social-card.png static/img/

echo "All images copied successfully."
