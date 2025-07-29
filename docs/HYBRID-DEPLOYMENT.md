# Hybrid Deployment Guide

This document explains how to configure the MARA system to use either the legacy Netlify/Airtable backend or the new Supabase backend during the transition period.

## Configuration

The system uses environment variables to determine which backend to use:

### Environment Variables

#### For Legacy System (Default)

```bash
# Use legacy Netlify functions and Airtable
VITE_USE_SUPABASE=false
VITE_MARA_API_URL=https://your-netlify-site.netlify.app
```

#### For New Supabase System

```bash
# Use new Supabase Edge Functions (with Netlify fallback)
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MARA_API_URL=https://your-netlify-site.netlify.app  # Still needed for fallbacks
```

#### For Pure Supabase System (No Netlify)

```bash
# Pure Supabase deployment - eliminates Netlify entirely
VITE_USE_SUPABASE=true
VITE_SUPABASE_ONLY=true
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_MARA_API_URL not needed in pure mode
```

## API Behavior

### Legacy Mode (`VITE_USE_SUPABASE=false` or not set)

- **Weekly Incidents**: `/.netlify/functions/get-weekly-incidents`
- **Report Content**: `/.netlify/functions/get-weekly-report-content`
- **PDF Export**: `/.netlify/functions/generate-weekly-pdf`
- **Subscriptions**: Not available (graceful degradation)

### Supabase Mode (`VITE_USE_SUPABASE=true`)

- **Weekly Incidents**: Supabase Edge Function `generate-weekly-report`
- **Report Content**: Supabase Edge Function `generate-weekly-report` with `includeAnalysis: true`
- **PDF Export**: Supabase Edge Function `generate-weekly-report` with `format: "pdf"`
- **Subscriptions**: Full functionality using `user_email_preferences` table

## Feature Compatibility

| Feature              | Legacy Mode | Supabase Mode |
| -------------------- | ----------- | ------------- |
| Weekly Report Viewer | ✅ Full     | ✅ Full       |
| Navigation           | ✅ Full     | ✅ Full       |
| PDF Export           | ✅ Full     | ✅ Full       |
| Email Subscriptions  | ⚠️ Disabled | ✅ Full       |
| User Preferences     | ⚠️ Disabled | ✅ Full       |
| Caching              | ❌ None     | ✅ Full       |
| Real-time Updates    | ❌ None     | ✅ Available  |

## Deployment Strategies

### 1. Gradual Migration (Recommended)

1. **Phase 1**: Deploy with `VITE_USE_SUPABASE=false` (current state)
2. **Phase 2**: Test Supabase system in staging with `VITE_USE_SUPABASE=true`
3. **Phase 3**: Enable Supabase for specific users/features
4. **Phase 4**: Full migration to `VITE_USE_SUPABASE=true`

### 2. A/B Testing

Use feature flags or user segments to enable Supabase for specific users:

```javascript
// Example: Enable for specific users
const USE_SUPABASE =
  user.email.includes("@yourcompany.com") ||
  import.meta.env?.VITE_USE_SUPABASE === "true";
```

### 3. Rollback Strategy

If issues occur with Supabase mode:

1. Set `VITE_USE_SUPABASE=false`
2. Redeploy
3. System automatically falls back to legacy Netlify functions

## Testing

### Legacy Mode Testing

```bash
# Set environment
VITE_USE_SUPABASE=false

# Test endpoints
curl "https://your-site.netlify.app/.netlify/functions/get-weekly-incidents?start=2025-01-01T00:00:00Z&end=2025-01-07T23:59:59Z"
```

### Supabase Mode Testing

```bash
# Set environment
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key

# Test through UI or direct Supabase calls
```

## Monitoring

### Key Metrics to Monitor

1. **API Response Times**

   - Legacy: Netlify function cold starts
   - Supabase: Edge function performance

2. **Error Rates**

   - Monitor both systems during transition
   - Set up alerts for API failures

3. **User Experience**
   - Page load times
   - Feature availability
   - Subscription functionality

### Logging

The hybrid API logs which backend is being used:

```javascript
console.log(
  "Fetching weekly incidents with backend:",
  USE_SUPABASE ? "Supabase" : "Netlify"
);
```

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**

   - Check all required variables are set
   - Verify Supabase credentials are correct

2. **API Endpoint Mismatches**

   - Ensure legacy functions exist and are deployed
   - Verify Supabase Edge Functions are deployed

3. **Authentication Issues**
   - Supabase mode requires user authentication for subscriptions
   - Legacy mode gracefully degrades subscription features

### Debug Mode

Enable debug logging:

```bash
VITE_DEBUG=true
```

This will show detailed API calls and responses in the browser console.

## Migration Checklist

- [ ] Legacy Netlify functions are working
- [ ] Supabase Edge Functions are deployed
- [ ] Database migrations are applied
- [ ] Environment variables are configured
- [ ] Testing completed in both modes
- [ ] Monitoring is set up
- [ ] Rollback plan is ready
- [ ] Team is trained on new system

## Netlify Elimination Path

### Can I eliminate Netlify entirely?

**Yes!** Once you're fully migrated to Supabase mode, you can eliminate Netlify completely:

### What Netlify Currently Provides

1. **Static Site Hosting** - Can be replaced with:

   - Vercel
   - Supabase hosting (coming soon)
   - Cloudflare Pages
   - AWS S3 + CloudFront
   - Any static hosting provider

2. **Serverless Functions** - Replaced by:

   - ✅ Supabase Edge Functions (already implemented)
   - All API functionality migrated

3. **Build & Deploy Pipeline** - Can be replaced with:
   - GitHub Actions
   - Vercel deployments
   - Custom CI/CD pipeline

### Migration Timeline

#### Phase 1: Current (Hybrid)

- Frontend: Netlify hosting
- Backend: Choice of Netlify Functions OR Supabase Edge Functions
- Database: Supabase

#### Phase 2: Supabase Backend Only

- Frontend: Still Netlify hosting
- Backend: Pure Supabase Edge Functions (`VITE_SUPABASE_ONLY=true`)
- Database: Supabase

#### Phase 3: Complete Netlify Elimination

- Frontend: Alternative hosting (Vercel, etc.)
- Backend: Supabase Edge Functions
- Database: Supabase

### Pure Supabase Configuration

```bash
# Complete Netlify elimination
VITE_USE_SUPABASE=true
VITE_SUPABASE_ONLY=true
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Benefits of Eliminating Netlify

1. **Cost Reduction** - One less service to pay for
2. **Simplified Architecture** - Single backend provider
3. **Better Performance** - Direct Supabase connections
4. **Unified Monitoring** - All backend metrics in one place
5. **Reduced Complexity** - Fewer moving parts

### Recommended Alternative Hosting

**Vercel** (Recommended)

- Excellent React/Next.js support
- Built-in CI/CD
- Edge network
- Easy migration from Netlify

**Supabase Hosting** (Future)

- Native integration
- Single provider for everything
- Currently in development

## Support

For issues during the transition:

1. Check the browser console for backend selection logs
2. Verify environment variables
3. Test individual API endpoints
4. Use rollback strategy if needed
