# Incident Caching Implementation

This document explains the new incident caching system implemented for the flash report functionality and how to adopt it for other parts of the application.

## Overview

We've implemented a caching layer for incident data using Netlify Blobs. This provides several benefits:

1. **Improved Performance**: Reduces API calls to Airtable
2. **Consistent Data Format**: Standardizes data between client-side and server-side
3. **Reduced Rate Limiting**: Helps avoid hitting Airtable's API rate limits
4. **Data Enrichment**: Automatically enhances incident data with related information

## Implementation Details

### Key Components

1. **`/functions/utils/incident-cache.js`**:
   - Core caching functionality
   - Standardizes data structure
   - Handles cache invalidation

2. **`/functions/get-cached-incident.js`**:
   - New endpoint for retrieving cached incident data
   - Works in parallel with existing `get-incident.js`
   - Returns both flat and nested data formats

3. **Updated Flash Reports**:
   - `send-flash-report.js` now uses the cached incident data
   - Maintains backward compatibility with existing code

### Data Format

The cache stores incident data in two formats:

1. **Flat structure** (client-friendly):
   ```javascript
   {
     id: "2023-0123",
     type: "Robbery",
     title: "Armed Robbery Aboard Vessel X",
     vesselName: "Vessel X",
     vesselType: "Container Ship",
     status: "Underway",
     // ... other flat fields
   }
   ```

2. **Nested structure** (matches Airtable's structure for backward compatibility):
   ```javascript
   {
     nested: {
       incident: { fields: { /* incident fields */ } },
       vessel: { fields: { /* vessel fields */ } },
       incidentVessel: { fields: { /* relationship fields */ } },
       incidentType: { fields: { /* incident type fields */ } }
     }
   }
   ```

## How to Use the Cache

### In Netlify Functions

```javascript
import { getCachedIncident } from './utils/incident-cache.js';

// Get cached incident data (returns from cache or fetches if not in cache)
const incidentData = await getCachedIncident(incidentId);

// Force a refresh from the source
const freshData = await getCachedIncident(incidentId, { forceRefresh: true });

// Invalidate cache for an incident (e.g., after an update)
await invalidateIncidentCache(incidentId);
```

### From Client Components

Use the new endpoint:

```javascript
// React component example
const fetchCachedIncident = async (id) => {
  const response = await fetch(`/.netlify/functions/get-cached-incident?id=${id}`);
  return await response.json();
};
```

## Gradual Adoption Strategy

We're taking a gradual approach to adoption:

1. **Phase 1** (Current): 
   - Implement caching for flash reports
   - Create new endpoint in parallel with existing one

2. **Phase 2**:
   - Update client components to use cached data
   - Modify useIncident.js hook to use get-cached-incident endpoint

3. **Phase 3**:
   - Deprecate old get-incident.js function
   - Fully transition to cached data across the application

## Cache Invalidation

The cache is automatically invalidated when:

- The TTL (Time To Live) expires (default: 24 hours)
- Explicitly invalidated via the `invalidateIncidentCache` function

To implement webhook-based invalidation for real-time updates:
1. Create a webhook handler function
2. Use Airtable's webhook feature to notify when records change
3. Call `invalidateIncidentCache` when receiving a webhook

## Testing

To test the cache implementation:

1. Use the flash report email functionality with real incident IDs
2. Check Netlify logs for "Cache hit/miss" messages
3. Verify vessel data appears correctly in the emails

## Performance Monitoring

The cache logs detailed information about cache hits, misses, and data updates. You can monitor these in the Netlify function logs to track performance improvements.