/**
 * Setup script for the MARA documentation site
 * This script creates necessary directories and ensures the proper structure exists
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the directory structure
const directories = [
  'static/img',
  'src/img',
  'src/components/design',
  'api',
  'api/endpoints'
];

// Create directories if they don't exist
console.log('Creating directory structure...');
directories.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dir}`);
  } else {
    console.log(`Directory already exists: ${dir}`);
  }
});

// Copy image files from static to src/img (if they exist)
console.log('\nCopying images...');
try {
  const sourceDir = path.join(__dirname, '..', 'static/img');
  const destDir = path.join(__dirname, '..', 'src/img');
  
  if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir);
    files.forEach(file => {
      if (file.endsWith('.png') || file.endsWith('.svg') || file.endsWith('.jpg')) {
        const source = path.join(sourceDir, file);
        const dest = path.join(destDir, file);
        
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(source, dest);
          console.log(`Copied: ${file} to src/img`);
        }
      }
    });
  }
} catch (error) {
  console.error('Error copying image files:', error);
}

// Make scripts executable
console.log('\nMaking scripts executable...');
try {
  const scriptsDir = path.join(__dirname);
  const scriptFiles = fs.readdirSync(scriptsDir);
  
  scriptFiles.forEach(file => {
    if (file.endsWith('.sh')) {
      const scriptPath = path.join(scriptsDir, file);
      execSync(`chmod +x "${scriptPath}"`);
      console.log(`Made executable: ${file}`);
    }
  });
} catch (error) {
  console.error('Error making scripts executable:', error);
}

console.log('\nSetup completed successfully!');
console.log('\nNext steps:');
console.log('1. Run "npm install" to install dependencies');
console.log('2. Run "npm start" to start the development server');
console.log('3. Edit content in the docs/ directory');
