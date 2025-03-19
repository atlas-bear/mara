/**
 * Script to check for missing documentation files
 * This script verifies that all files referenced in the sidebar configurations exist
 */

import fs from "fs";
import path from "path";
import sidebars from "../sidebars";
import sidebarsApi from "../sidebarsApi";

console.log("Checking for missing documentation files...");

// Function to extract document IDs from sidebar items
function extractDocIds(items, docIds = []) {
  if (!items) return docIds;

  if (Array.isArray(items)) {
    items.forEach((item) => {
      if (typeof item === "string") {
        docIds.push(item);
      } else if (typeof item === "object") {
        if (item.type === "category" && item.items) {
          extractDocIds(item.items, docIds);
        } else if (item.id) {
          docIds.push(item.id);
        }
      }
    });
  } else if (typeof items === "object") {
    Object.values(items).forEach((value) => {
      extractDocIds(value, docIds);
    });
  }

  return docIds;
}

// Extract document IDs from sidebars
const mainDocIds = extractDocIds(sidebars.tutorialSidebar);
const apiDocIds = extractDocIds(sidebarsApi.apiSidebar);

console.log(`Found ${mainDocIds.length} document IDs in main sidebar`);
console.log(`Found ${apiDocIds.length} document IDs in API sidebar`);

// Check if files exist
function checkFilesExist(docIds, basePath) {
  const missingFiles = [];

  docIds.forEach((docId) => {
    // Handle special case for endpoints directory
    let filePath;
    if (docId.includes("/")) {
      const [dir, file] = docId.split("/");
      filePath = path.join(basePath, dir, `${file}.md`);
    } else {
      filePath = path.join(basePath, `${docId}.md`);
    }

    if (!fs.existsSync(filePath)) {
      missingFiles.push({ docId, filePath });
    }
  });

  return missingFiles;
}

const missingMainDocs = checkFilesExist(
  mainDocIds,
  path.join(__dirname, "../docs")
);
const missingApiDocs = checkFilesExist(
  apiDocIds,
  path.join(__dirname, "../api")
);

// Report missing files
if (missingMainDocs.length === 0 && missingApiDocs.length === 0) {
  console.log("✅ All documentation files exist!");
} else {
  console.log("\n⚠️ Missing documentation files:");

  if (missingMainDocs.length > 0) {
    console.log("\nMissing main documentation files:");
    missingMainDocs.forEach(({ docId, filePath }) => {
      console.log(`  - ${docId}: ${filePath}`);
    });
  }

  if (missingApiDocs.length > 0) {
    console.log("\nMissing API documentation files:");
    missingApiDocs.forEach(({ docId, filePath }) => {
      console.log(`  - ${docId}: ${filePath}`);
    });
  }

  console.log("\nGenerate missing files? (y/n)");
  process.stdin.once("data", (input) => {
    const answer = input.toString().trim().toLowerCase();

    if (answer === "y" || answer === "yes") {
      console.log("\nGenerating stub files for missing documentation...");

      // Generate stub files
      function generateStubFile(docId, filePath) {
        const title = docId
          .split("/")
          .pop()
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        const content = `---
id: ${docId.split("/").pop()}
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

        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`Created directory: ${dir}`);
        }

        // Write the stub file
        fs.writeFileSync(filePath, content);
        console.log(`Generated stub file: ${filePath}`);
      }

      // Generate missing files
      [...missingMainDocs, ...missingApiDocs].forEach(({ docId, filePath }) => {
        generateStubFile(docId, filePath);
      });

      console.log("\n✅ All missing files have been generated as stubs.");
      console.log("You should now edit these files to add proper content.");

      process.exit(0);
    } else {
      console.log("Operation cancelled. No files were generated.");
      process.exit(1);
    }
  });
}
