# MARA Deployment Guide

This guide provides comprehensive instructions for deploying both the MARA applications and the documentation site.

## Application Deployment

### Prerequisites

- Netlify account with appropriate permissions
- Git repository access
- Environment variables configured in Netlify

### Deploying to Netlify

MARA applications are deployed to Netlify following these steps:

1. **Connect Repository to Netlify**:
   - Log in to Netlify
   - Click "New site from Git"
   - Select your Git provider (GitHub, GitLab, etc.)
   - Select the MARA repository
   - Configure build settings:
     - For the main app:
       - Build command: `npm run build -- --filter @mara/app`
       - Publish directory: `src/apps/mara/dist`
     - For the client app:
       - Build command: `npm run build -- --filter @mara/client`
       - Publish directory: `src/apps/client/dist`

2. **Configure Environment Variables**:
   - In the Netlify site settings, go to "Environment variables"
   - Add all required environment variables (see Installation Guide)

3. **Configure Netlify Functions**:
   - Ensure the `netlify.toml` file is correctly set up
   - Verify the functions directory is correctly specified
   - Configure function scheduling if needed

### Manual Deployment

To manually trigger a deployment:

```bash
npm run build -- --filter @mara/app
netlify deploy --prod --dir=src/apps/mara/dist
```

For the client app:

```bash
npm run build -- --filter @mara/client
netlify deploy --prod --dir=src/apps/client/dist
```

## Documentation Site Deployment

The documentation site is deployed using GitHub Pages through a GitHub Actions workflow.

### Using GitHub Actions

The repository is configured with a GitHub Actions workflow file that handles automatic deployment:

1. **Push changes to the main branch**:
   ```bash
   git add .
   git commit -m "Update documentation"
   git push origin main
   ```

2. **The workflow will**:
   - Set up Node.js
   - Install dependencies
   - Build the documentation site
   - Deploy to GitHub Pages

### Manual Documentation Deployment

If you need to deploy the documentation manually:

```bash
cd docs-vitepress
npm run build
```

Then deploy the generated files in the `.vitepress/dist` directory to your hosting provider.

## Scheduled Functions Configuration

MARA includes several scheduled functions that need to be configured in Netlify:

```toml
# Example from netlify.toml
[functions]
directory = "functions"
node_bundler = "esbuild"

# Scheduled functions
[functions."collect-recaap"]
schedule = "0,30 * * * *"

[functions."process-incidents"]
schedule = "25,55 * * * *"

[functions."deduplicate-cross-source-background"]
schedule = "28 * * * *"
background = true

[functions."get-weekly-report-content-background"]
schedule = "0 21 * * 1"
background = true
```

Ensure these schedules are configured correctly for your needs.

## Adding a New White-Label Client

To deploy a new white-labeled client:

1. Create the new client app as described in the Architecture documentation
2. Create a new Netlify site for this client
3. Configure the site with the appropriate build settings:
   - Build command: `npm run build -- --filter @mara/new-client`
   - Publish directory: `src/apps/new-client/dist`
4. Add client-specific environment variables
5. Deploy the site

## Post-Deployment Verification

After deployment, verify that:

1. The application loads correctly
2. All features are functioning properly
3. Scheduled functions are running as expected
4. Environment variables are correctly applied

## Troubleshooting

### Common Deployment Issues

1. **Build Failures**:
   - Check the build logs for specific errors
   - Verify all dependencies are correctly installed
   - Ensure environment variables are properly configured

2. **Function Execution Errors**:
   - Check the Netlify function logs
   - Verify function permissions and environment variables
   - Test functions locally before deployment

3. **CORS Issues**:
   - Ensure your CORS headers are correctly configured
   - Verify API endpoint permissions

4. **Environment Variables**:
   - Double-check that all required variables are set
   - Ensure variable names match exactly what's expected in the code

## Rollback Procedure

If a deployment causes issues:

1. **In Netlify**:
   - Go to the "Deploys" section for your site
   - Find the last working deployment
   - Click "Publish deploy" to roll back

2. **For code**:
   - Git revert the problematic commit
   - Push the revert commit
   - Let Netlify automatically deploy the reverted code

## Continuous Integration

For a more robust CI/CD pipeline:

1. Set up branch previews in Netlify for testing before merging to main
2. Configure notification webhooks for deployment status
3. Add integration tests that run after deployment
4. Consider using Netlify split testing for gradual rollouts