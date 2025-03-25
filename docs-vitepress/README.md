# MARA Documentation

This directory contains the official MARA documentation based on VitePress. It provides comprehensive information about the MARA architecture, features, and APIs.

## Documentation Structure

The documentation is organized into the following sections:

- **Guide**: Overview, architecture, installation, and deployment
- **Components**: Reusable UI components documentation
- **Data Pipeline**: Data collection, processing, and standardization
- **Deduplication**: Cross-source deduplication system
- **Flash Report**: Immediate incident notification system
- **Weekly Report**: Weekly maritime security analysis
- **API**: API reference and integration guides

## Local Development

To work on the documentation:

```bash
cd docs-vitepress
npm install
npm run dev
```

This will start a development server at `http://localhost:5173/mara/` with hot-reloading enabled.

## Building the Documentation

To build the documentation for production:

```bash
cd docs-vitepress
npm run build
```

This generates static files in the `.vitepress/dist` directory.

## Migration Status

This documentation is the result of a migration from the previous Docusaurus-based system to VitePress. The migration has been completed with all content transferred from the old docs/ and docs1/ directories. 

Refer to [MIGRATION-PLAN.md](./MIGRATION-PLAN.md) for details on the migration process and remaining steps.

## Documentation Update Process

When updating the documentation:

1. Make changes to the relevant Markdown files
2. Run `npm run dev` to preview changes locally
3. Commit changes to the repository
4. GitHub Actions will automatically build and deploy the documentation

## Adding New Documentation

To add new documentation:

1. Create a new Markdown file in the appropriate directory
2. Update the sidebar configuration in `.vitepress/config.mjs` if needed
3. Link to the new page from relevant existing pages

## Documentation Guidelines

- Use clear, concise language
- Include code examples where appropriate
- Use relative links for internal references
- Include diagrams for complex concepts
- Keep the documentation up to date with code changes

## Final Directory Structure Transition Plan

After the documentation has been reviewed and approved:

1. The old docs/ and docs1/ directories will be removed
2. This docs-vitepress/ directory will be renamed to docs/
3. All repository references will be updated to point to the new docs/ directory