# MARA Documentation Site Troubleshooting Guide

This guide addresses common issues you might encounter when setting up, developing, or deploying the MARA documentation site.

## Installation Issues

### Node.js Version Errors

**Problem**: Error messages indicating incompatibility with your Node.js version.

**Solution**: 
- Ensure you're using Node.js version 18.0 or higher
- You can check your version with `node --version`
- If needed, install a newer version using [nvm](https://github.com/nvm-sh/nvm) or directly from the [Node.js website](https://nodejs.org/)

### Dependency Installation Fails

**Problem**: Errors when running `npm install` or missing dependencies.

**Solution**:
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` directory and `package-lock.json`: `rm -rf node_modules package-lock.json`
- Reinstall dependencies: `npm install`
- If specific packages fail, try installing them individually

## Development Server Issues

### Server Won't Start

**Problem**: Errors when running `npm start`.

**Solution**:
- Check for syntax errors in your configuration files
- Ensure all required files exist
- Verify that the port (usually 3000) isn't being used by another application
- Try clearing the cache: `npm run clear`

### Missing Sidebar Items

**Problem**: Documentation sidebar is missing expected items.

**Solution**:
- Check that all files referenced in `sidebars.js` and `sidebarsApi.js` actually exist
- Ensure each document has a proper `id` in its frontmatter
- Verify the file structure matches what's defined in the sidebar configuration

### CSS or Styling Issues

**Problem**: Styles aren't applying correctly or appearance is broken.

**Solution**:
- Clear your browser cache or try in incognito mode
- Check that `custom.css` is being loaded properly
- Inspect browser console for CSS errors
- Verify that the theme configuration in `docusaurus.config.js` is correct

## Build Issues

### Build Fails with Errors

**Problem**: Errors when running `npm run build`.

**Solution**:
- Look for broken links - Docusaurus checks links during build
- Check for syntax errors in Markdown files
- Verify that all referenced images and assets exist
- Run `npm run clear` before building again

### Images Not Loading in Build

**Problem**: Images that work in development don't appear in the build.

**Solution**:
- Ensure images are in the correct `static/img` directory
- Use the correct path format in your Markdown: `/img/your-image.png`
- Verify image filenames don't contain spaces or special characters

## Deployment Issues

### GitHub Pages Deployment Fails

**Problem**: Errors when deploying to GitHub Pages.

**Solution**:
- Ensure you have the correct permissions on the GitHub repository
- Check that the repository name and organization in `docusaurus.config.js` match your GitHub repository
- Verify your GitHub authentication credentials
- If using SSH, ensure your SSH keys are set up correctly

### Incorrect Base URL

**Problem**: Site deploys but with broken links or missing resources.

**Solution**:
- Check the `baseUrl` setting in `docusaurus.config.js`
- For GitHub Pages project sites, this should typically be `/<repository-name>/`
- Make sure trailing slashes are handled consistently

## Content Issues

### Markdown Not Rendering Correctly

**Problem**: Markdown formatting doesn't look right when published.

**Solution**:
- Check for syntax errors in your Markdown
- Ensure proper spacing (especially for lists and code blocks)
- Verify that special characters are properly escaped
- Use a Markdown linter to identify formatting issues

### Broken Links

**Problem**: Links to other pages result in 404 errors.

**Solution**:
- Check the path in your links
- For internal docs links, use the document `id` rather than the path
- Run `npm run build` to identify broken links automatically
- Verify that referenced pages exist in your project

## Performance Issues

### Site Loads Slowly

**Problem**: The documentation site has poor performance.

**Solution**:
- Optimize image sizes
- Reduce the number of custom fonts
- Consider lazy-loading for large components
- Check for unnecessary JavaScript that might be slowing down the site

## Getting Additional Help

If you continue experiencing issues after trying these troubleshooting steps:

1. Check the [Docusaurus documentation](https://docusaurus.io/docs)
2. Search for similar issues in the [Docusaurus GitHub repository](https://github.com/facebook/docusaurus/issues)
3. Open an issue in the MARA repository with details about your problem
4. Contact the development team on the internal communication channels
