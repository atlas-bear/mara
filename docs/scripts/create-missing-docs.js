/**
 * Script to automatically create missing documentation files
 * This script creates placeholder files for all documents referenced in sidebars
 */

const fs = require('fs');
const path = require('path');

// Define the sidebar configurations manually to avoid import issues
const sidebarsApi = {
  apiSidebar: [
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'overview',
        'authentication',
        {
          type: 'category',
          label: 'Endpoints',
          items: [
            'endpoints/incidents',
            'endpoints/reports',
            'endpoints/hotspots',
            'endpoints/countries',
            'endpoints/ports',
          ],
        },
        'error-codes',
        'rate-limits',
        'changelog',
      ],
    },
  ],
};

console.log('Creating any missing API documentation files...');

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

// Extract document IDs from API sidebar
const apiDocIds = extractDocIds(sidebarsApi.apiSidebar);
console.log(`Found ${apiDocIds.length} document IDs in API sidebar`);

// Create files if they don't exist
function createMissingFiles(docIds, basePath) {
  let createdCount = 0;
  
  docIds.forEach(docId => {
    // Handle special case for endpoints directory
    let filePath;
    if (docId.includes('/')) {
      const [dir, file] = docId.split('/');
      filePath = path.join(basePath, dir, `${file}.md`);
      
      // Create directory if it doesn't exist
      const dirPath = path.join(basePath, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
      }
    } else {
      filePath = path.join(basePath, `${docId}.md`);
    }
    
    if (!fs.existsSync(filePath)) {
      // Generate content for the file
      const title = docId.split('/').pop()
                         .replace(/-/g, ' ')
                         .replace(/\b\w/g, l => l.toUpperCase());
      
      const content = `---
id: ${docId.split('/').pop()}
title: ${title}
sidebar_label: ${title}
---

# ${title}

This page is a placeholder for the "${title}" documentation.

## Coming Soon

This content is currently being developed and will be available soon. Check back later for updates.

## Need Help?

If you need immediate assistance with this topic, please contact us at [support@atlas-bear.com](mailto:support@atlas-bear.com).
`;
      
      // Write the file
      fs.writeFileSync(filePath, content);
      console.log(`Created missing file: ${filePath}`);
      createdCount++;
    }
  });
  
  return createdCount;
}

// Create the base API directory if it doesn't exist
const apiDirPath = path.join(__dirname, '../api');
if (!fs.existsSync(apiDirPath)) {
  fs.mkdirSync(apiDirPath, { recursive: true });
  console.log(`Created API directory: ${apiDirPath}`);
}

// Create missing API documentation files
const createdCount = createMissingFiles(apiDocIds, apiDirPath);

if (createdCount > 0) {
  console.log(`\n✅ Created ${createdCount} missing documentation files.`);
  console.log('You should now edit these files to add proper content.');
} else {
  console.log('✅ All documentation files already exist!');
}
