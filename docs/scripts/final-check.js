/**
 * Final check script to ensure all required files are present
 * and the site is ready to run
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

console.log('Running final check for MARA documentation site...\n');

// Define critical files that must exist
const criticalFiles = [
  // Configuration files
  'docusaurus.config.js',
  'sidebars.js',
  'sidebarsApi.js',
  'package.json',
  
  // Main documentation
  'docs/intro.md',
  'docs/getting-started.md',
  
  // API documentation
  'api/overview.md',
  'api/authentication.md',
  'api/endpoints/incidents.md',
  'api/error-codes.md',
  'api/rate-limits.md',
  'api/changelog.md',
  
  // CSS and styling
  'src/css/custom.css',
  'src/css/fonts.css',
  
  // React components
  'src/pages/index.js',
  'src/pages/index.module.css',
  
  // Assets
  'static/img/mara_logo.svg',
  'src/img/paper-texture-light.png',
  'src/img/paper-texture-dark.png'
];

// Count of issues found
let issuesFound = 0;

// Check for missing critical files
console.log('Checking for critical files...');
const missingFiles = criticalFiles.filter(file => !fs.existsSync(path.join(__dirname, '..', file)));

if (missingFiles.length === 0) {
  console.log('✅ All critical files are present');
} else {
  console.log('❌ Missing critical files:');
  missingFiles.forEach(file => console.log(`   - ${file}`));
  issuesFound += missingFiles.length;
}

// Check if API documentation files match sidebar entries
console.log('\nChecking API documentation completeness...');

// First, read the sidebar configuration
const sidebarsApiPath = path.join(__dirname, '../sidebarsApi.js');
let apiDocIds = [];

if (fs.existsSync(sidebarsApiPath)) {
  try {
    const sidebarsApi = require('../sidebarsApi');
    
    // Function to extract document IDs from sidebar items
    function extractDocIds(items, docIds = []) {
      if (!items) return docIds;
      
      if (Array.isArray(items)) {
        items.forEach(item => {
          if (typeof item === 'string') {
            docIds.push(item);
          } else if (typeof item === 'object') {
            if (item.type === 'category' && item.items) {
              extractDocIds(item.items, docIds);
            } else if (item.id) {
              docIds.push(item.id);
            }
          }
        });
      } else if (typeof items === 'object') {
        Object.values(items).forEach(value => {
          extractDocIds(value, docIds);
        });
      }
      
      return docIds;
    }
    
    apiDocIds = extractDocIds(sidebarsApi.apiSidebar);
    
    // Check if files exist
    const missingApiDocs = apiDocIds.filter(docId => {
      // Handle special case for endpoints directory
      let filePath;
      if (docId.includes('/')) {
        const [dir, file] = docId.split('/');
        filePath = path.join(__dirname, '../api', dir, `${file}.md`);
      } else {
        filePath = path.join(__dirname, '../api', `${docId}.md`);
      }
      
      return !fs.existsSync(filePath);
    });
    
    if (missingApiDocs.length === 0) {
      console.log('✅ All API documentation files exist');
    } else {
      console.log('❌ Missing API documentation files:');
      missingApiDocs.forEach(docId => console.log(`   - ${docId}`));
      issuesFound += missingApiDocs.length;
      
      // Offer to create missing files
      console.log('\nWould you like to create placeholder files for missing API docs? (y/n)');
      process.stdin.once('data', (input) => {
        const answer = input.toString().trim().toLowerCase();
        
        if (answer === 'y' || answer === 'yes') {
          console.log('Running create-missing-docs.js...');
          exec('node scripts/create-missing-docs.js').then(() => {
            console.log('Continue with the check...');
            finishCheck();
          }).catch(error => {
            console.error('Error creating missing docs:', error);
            finishCheck();
          });
        } else {
          console.log('Skipping creation of missing files.');
          finishCheck();
        }
      });
      return; // Exit this function and wait for user input
    }
  } catch (error) {
    console.log('❌ Error parsing sidebarsApi.js');
    console.error(error);
    issuesFound += 1;
  }
} else {
  console.log('❌ sidebarsApi.js is missing');
  issuesFound += 1;
}

// Continue with the rest of the checks
finishCheck();

function finishCheck() {
  // Check package.json dependencies
  console.log('\nChecking package.json dependencies...');
  try {
    const packageJson = require('../package.json');
    const requiredDeps = [
      '@docusaurus/core',
      '@docusaurus/preset-classic',
      'react',
      'react-dom'
    ];
    
    const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
    
    if (missingDeps.length === 0) {
      console.log('✅ All required dependencies are present');
    } else {
      console.log('❌ Missing dependencies in package.json:');
      missingDeps.forEach(dep => console.log(`   - ${dep}`));
      issuesFound += missingDeps.length;
    }
  } catch (error) {
    console.log('❌ Error checking package.json');
    console.error(error);
    issuesFound += 1;
  }

  // Final report
  console.log('\n----- Final Check Report -----');
  if (issuesFound === 0) {
    console.log('✅ All checks passed! The site should be ready to run.');
    console.log('\nNext steps:');
    console.log('1. Run "npm install" if you haven\'t already');
    console.log('2. Run "npm start" to start the development server');
    console.log('3. Visit http://localhost:3000/mara/ to view the site');
  } else {
    console.log(`❌ Found ${issuesFound} issue(s) that need to be addressed.`);
    console.log('\nRecommended fixes:');
    console.log('1. Create any missing critical files');
    console.log('2. Run "node scripts/create-missing-docs.js" to create placeholder API documentation');
    console.log('3. Check the error messages above for specific issues');
    console.log('4. Consult TROUBLESHOOTING.md for additional help');
  }
}
