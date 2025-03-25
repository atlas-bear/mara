# Documentation Migration Plan: Docusaurus to VitePress

This document outlines the plan for migrating the MARA documentation from Docusaurus to VitePress.

## Migration Status

| Status | Task |
|--------|------|
| ✅ | Create basic VitePress setup |
| ✅ | Configure navigation and sidebar structure |
| ✅ | Migrate home page content |
| ✅ | Migrate guide section |
| ✅ | Migrate data pipeline documentation |
| ✅ | Migrate deduplication documentation |
| ✅ | Migrate flash report documentation |
| ✅ | Migrate weekly report documentation |
| ✅ | Migrate API documentation |
| ✅ | Migrate component documentation |
| ✅ | Add installation and deployment guides |
| ✅ | Set up VitePress-JSDoc integration |
| ✅ | Configure GitHub Actions for deployment |
| ✅ | Test documentation locally |
| ⬜ | Deploy to GitHub Pages |
| ⬜ | Update repository to use new documentation |
| ⬜ | Remove old Docusaurus documentation |

## Migration Steps

### 1. Setup and Configuration

- [x] Create new `docs-vitepress` directory
- [x] Initialize VitePress
- [x] Configure navigation and sidebar structure
- [x] Set up theming and styling
- [x] Configure JSDoc integration

### 2. Content Migration

- [x] Home page
- [x] Guide section
- [x] Data pipeline documentation
- [x] Deduplication system documentation
- [x] Flash report documentation
- [x] Weekly report documentation
- [x] API documentation
- [x] Component documentation
- [x] Installation and deployment guides

### 3. Deployment Setup

- [x] Configure GitHub Actions workflow
- [x] Set up GitHub Pages deployment
- [x] Configure base URL for production

### 4. Testing and Verification

- [x] Local testing:
  - [x] Navigation links
  - [x] Images and assets
  - [x] API documentation generation
  - [x] Mobile responsiveness

### 5. Transition

- [ ] Deploy to GitHub Pages
- [ ] Update repository documentation references
- [ ] Remove old documentation (docs/ and docs1/ directories)
- [ ] Rename docs-vitepress to docs

## Final Steps for Documentation Restructuring

1. **Deploy the VitePress Documentation**
   - Confirm all content is migrated and properly linked
   - Deploy to GitHub Pages to verify everything works in production

2. **Directory Cleanup**
   - After successful deployment, remove the old docs/ and docs1/ directories
   - Rename docs-vitepress to docs to simplify the structure

3. **Update Repository References**
   - Update any references in the codebase or READMEs to point to the new documentation location

## Notes

- The new documentation structure follows a more intuitive organization
- API documentation is now generated automatically from JSDoc comments
- The new system uses GitHub Actions for continuous deployment
- Local development is simplified with the VitePress hot-reload system

## References

- [VitePress Documentation](https://vitepress.dev/)
- [JSDoc Documentation](https://jsdoc.app/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)