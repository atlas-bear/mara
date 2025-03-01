# MARA Project Guide

## Commands
- Build: `npm run build` - Builds all workspaces using Turbo
- Dev: `npm run dev` - Runs development servers for all apps
- Preview: `npm run preview` - Runs preview servers
- Clean: `npm run clean` - Cleans and reinstalls dependencies
- App-specific dev: `cd src/apps/mara && npm run dev`
- Client-specific dev: `cd src/apps/client && npm run dev`

## Code Style
- Frontend: React functional components with ES Modules syntax
- Backend: CommonJS syntax for serverless functions
- Styling: TailwindCSS with component-scoped CSS modules
- Error handling: Try/catch blocks with appropriate logging
- Documentation: JSDoc comments for functions
- Naming: PascalCase for components, camelCase for functions/variables
- File structure: Component directories include index.jsx and styles.js/css

## Architecture
- Monorepo using Turborepo
- Apps in src/apps/*, shared code in src/shared
- Serverless functions in /functions directory
- Environment variables for configuration
- Cloudinary for file storage, Puppeteer for PDF generation