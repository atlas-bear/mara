# Deduplication System Implementation Guide

This guide provides technical details about the implementation of the cross-source deduplication system in MARA.

## Function Components

### Main Function

The main function `deduplicate-cross-source-background.js` orchestrates the deduplication process:

```javascript
export default async (req, context) => {
  // Configuration
  const dryRun = req.queryStringParameters?.dryRun === "true";
  const confidenceThreshold = parseFloat(req.queryStringParameters?.confidenceThreshold) || 0.7;
  
  // Main workflow:
  // 1. Fetch recent raw_data records
  // 2. Group by source
  // 3. Calculate similarity scores for cross-source pairs
  // 4. Identify potential matches
  // 5. Determine primary/secondary records
  // 6. Merge complementary data
  // 7. Update records in Airtable
  // 8. Trigger incident processing
}
```

### Utility Modules

#### Spatial Utilities (`spatial-utils.js`)

Provides functions for geographic and temporal calculations:

- `calculateDistance`: Haversine formula for calculating distance between coordinates
- `calculateTimeDifference`: Time difference in hours between incidents
- `isValidCoordinate`: Validates geographic coordinates
- `calculateTimeProximityScore`: Converts time difference to a similarity score
- `calculateSpatialProximityScore`: Converts distance to a similarity score

#### Similarity Utilities (`similarity-utils.js`)

Text and entity matching algorithms:

- `calculateVesselNameSimilarity`: Compares vessel names with normalization
- `calculateIMOSimilarity`: Exact matching for IMO numbers
- `calculateIncidentTypeSimilarity`: Compares incident categories using reference data
- `levenshteinDistance`: String similarity algorithm

#### Deduplication Utilities (`deduplication-utils.js`)

Core deduplication logic:

- `calculateSimilarityScore`: Combines multiple factors into overall similarity
- `calculateCompletenessScore`: Evaluates record completeness
- `getSourcePriority`: Assigns priority based on source reliability
- `determinePrimaryRecord`: Selects the most appropriate record as primary
- `mergeComplementaryData`: Combines data from matched records

## Data Structures

### Record Format

The raw_data records contain:

```javascript
{
  id: "recXXXXXXXXXXXXXX",  // Airtable record ID
  fields: {
    date: "2025-03-18T19:30:00.000Z",
    latitude: "1.083333333",
    longitude: "103.7175",
    vessel_name: "SAMPLE VESSEL",  // Often null for non-RECAAP sources
    vessel_imo: "1234567",         // Often null for non-RECAAP sources
    incident_type_name: "Robbery",
    source: "ICC",                 // Source system name
    // Other fields...
  }
}
```

### Similarity Score Object

The similarity calculation returns:

```javascript
{
  total: 0.85,            // Overall similarity (0.0-1.0)
  time: 0.95,             // Time proximity score  
  spatial: 0.98,          // Spatial proximity score
  vessel: 0.5,            // Combined vessel similarity
  vesselName: 0.5,        // Vessel name similarity
  vesselIMO: 0,           // IMO number match (0 or 1)
  incidentType: 0.8,      // Incident type similarity
  rawDistance: 5.3,       // Distance in kilometers
  rawTimeDifference: 1.5  // Time difference in hours
}
```

### Merge Information

When records are merged, the following data is recorded:

```javascript
// Primary record updates
{
  merge_status: "merged",
  merge_score: "{"primarySource":"RECAAP","secondarySource":"ICC","mergeDate":"2025-03-24T16:15:42.513Z"}",
  related_raw_data: ["recXXXXXXXXXXXXXX"],  // Array of secondary record IDs
  processing_notes: "Merged with complementary data from ICC (recXXXXXXXXXXXXXX) at 2025-03-24T16:15:42.513Z"
}

// Secondary record updates
{
  merge_status: "merged_into",
  merged_into: ["recYYYYYYYYYYYYYY"],  // Reference to primary record
  processing_status: "Merged",
  processing_notes: "Merged into recYYYYYYYYYYYYYY (RECAAP) at 2025-03-24T16:15:42.513Z"
}
```

## Technical Considerations

### Handling Missing Data and Merge Chains

The system is designed to handle missing data gracefully and respect existing merge relationships:

```javascript
// Special handling for missing vessel data
const bothMissingVesselInfo = (!fields1.vessel_name && !fields2.vessel_name);
const vesselScore = vesselIMOScore === 1 ? 1 : 
                   bothMissingVesselInfo ? 0.7 : vesselNameScore;
```

The system also tracks and follows merge chains to maintain data integrity:

```javascript
// Helper function to find the ultimate primary record in a merge chain
async function findPrimaryRecord(recordId, headers) {
  // Start with the given record
  let currentId = recordId;
  let depth = 0;
  const maxDepth = 5; // Prevent infinite loops
  
  try {
    while (depth < maxDepth) {
      // Get the record
      const response = await axios.get(
        `https://api.airtable.com/v0/${airtableBaseId}/raw_data/${currentId}`,
        { headers }
      );
      
      const record = response.data;
      
      // If this record is merged into another, follow the chain
      if (record.fields.merge_status === "merged_into" && 
          record.fields.merged_into && 
          record.fields.merged_into.length > 0) {
        
        // Move to the next record in the chain
        currentId = record.fields.merged_into[0];
        depth++;
        log.info(`Following merge chain: ${recordId} -> ${currentId} (depth: ${depth})`);
      } else {
        // We've found the end of the chain
        return record;
      }
    }
    
    log.warn(`Merge chain too deep for record ${recordId}`);
    return null;
  } catch (error) {
    log.error(`Error finding primary record for ${recordId}`);
    return null;
  }
}
```

### Weight Distribution for Similarity

The raw data deduplication system prioritizes time and location data over vessel information:

```javascript
// Weight distribution: 40% time, 40% location, 10% vessel, 10% incident type
const totalScore =
  timeScore * 0.4 +
  spatialScore * 0.4 +
  vesselScore * 0.1 +
  incidentTypeScore * 0.1;
```

The incident-level deduplication uses a slightly different weight distribution with more emphasis on vessel matching:

```javascript
// Weight distribution: 35% time, 35% location, 30% vessel
const totalScore = timeScore * 0.35 + spatialScore * 0.35 + vesselScore * 0.3;
```

### Function Triggering

After completion, the system triggers incident processing:

```javascript
try {
  const siteUrl = process.env.PUBLIC_URL;
  if (!siteUrl) {
    log.error("PUBLIC_URL environment variable not set");
  } else {
    await axios.post(`${siteUrl}/.netlify/functions/process-raw-data-background`);
    log.info("Triggered process-raw-data-background function");
  }
} catch (triggerError) {
  log.error("Failed to trigger process-raw-data-background", {
    error: triggerError.message
  });
}
```

## Configuration in Netlify

The function is configured to run as a scheduled background function in `netlify.toml`:

```toml
[functions."deduplicate-cross-source-background"]
schedule = "28 * * * *"  # Run at 28 minutes past every hour
background = true
```

## Incident-Level Deduplication

In addition to the raw data deduplication system, MARA implements a second layer of deduplication at the incident table level to prevent creating duplicate incidents from different raw data sources that weren't merged during the initial deduplication step.

### Overview

When `process-raw-data-background.js` processes a raw data record to create an incident, it first checks if a similar incident already exists in the incident table. If a match is found, it updates the existing incident with any new information instead of creating a duplicate.

```javascript
// Check if this record is part of a merge chain
let mergedWithRecord = null;

if (recordToProcess.fields.merge_status === "merged_into" && 
    recordToProcess.fields.merged_into && 
    recordToProcess.fields.merged_into.length > 0) {
    
  log.info("This record has been merged into another record", {
    mergedInto: recordToProcess.fields.merged_into[0]
  });
  
  // Find the record it was merged into and check if it's linked to an incident
  // If so, link this record to the same incident
  // [code to follow merge chain and link to the same incident]
}

// If not part of a merge chain, check if a similar incident already exists
const existingIncident = await findSimilarExistingIncident(
  recordToProcess.fields.date,
  recordToProcess.fields.latitude,
  recordToProcess.fields.longitude,
  recordToProcess.fields.vessel_name,
  headers
);

if (existingIncident) {
  // Update existing incident with new information
  // Link this raw_data record to the existing incident
} else {
  // Create a new incident
}
```

### Similarity Calculation

The incident similarity check uses multiple factors:

1. **Time proximity**: Incidents within a 48-hour window receive a non-zero score
2. **Spatial proximity**: Incidents within 50km receive a non-zero score
3. **Vessel similarity**: Based on vessel name matching
4. **Incident type**: Exact matching of incident types
5. **Location name**: Matching location names (like "Singapore Strait") 
6. **Stolen items**: Matching specific items mentioned in descriptions
7. **Vessel information**: Flag, type, and other available details

### Enhanced Match Criteria

The system uses specific scenarios to determine if two incidents are the same:

```javascript
// HIGH CONFIDENCE MATCH CRITERIA:
// 1. Very close in time (within 12 hours) AND very close in space (within 5km) AND same/similar vessel
// 2. Exact vessel match AND reasonably close in time and space
// 3. Perfect time/location match with exact same details
// 4. Types match exactly with good time/space correlation
// 5. Very strong spatial match (within 2km) with reasonable time
// 6. Same location name with good time/space correlation
// 7. Matching stolen items or incident details
let isSameIncident = false;

// Case 1: Very close in time/space with vessel confirmation
if (timeScore > 0.75 && spatialScore > 0.9 && vesselScore >= 0.7) {
  isSameIncident = true;
  log.info("Match case 1: Close time/space with vessel confirmation", {
    timeScore, spatialScore, vesselScore
  });
}

// Case 2: Strong vessel match with reasonable time/space correlation
if (vesselMatch && timeScore > 0.5 && spatialScore > 0.7) {
  isSameIncident = true;
  log.info("Match case 2: Strong vessel match with good time/space", {
    timeScore, spatialScore, vesselMatch
  });
}

// Case 3: Perfect time/location match (exact same coordinates and timestamp)
if (timeScore > 0.95 && spatialScore > 0.95) {
  isSameIncident = true;
  log.info("Match case 3: Perfect time/location match");
}

// Case 4: Type match with reasonable time/space correlation
if (typeMatch && timeScore > 0.6 && spatialScore > 0.7) {
  isSameIncident = true;
  log.info("Match case 4: Type match with good time/space");
}

// Case 5: Very strong spatial match with reasonable time
if (spatialScore > 0.95 && timeScore > 0.6) {
  isSameIncident = true;
  log.info("Match case 5: Very strong location match with good time");
}

// Case 6: Location name matching
if (locationNameMatch && timeScore > 0.7 && spatialScore > 0.6) {
  isSameIncident = true;
  log.info("Match case 6: Location name match with good time/space");
}

// Case 7: Matching stolen items with reasonable proximity
if (stolenItemsMatch && timeScore > 0.5 && spatialScore > 0.5) {
  isSameIncident = true;
  log.info("Match case 7: Matching stolen items with reasonable time/space");
}
```

### Safeguards for Multiple Incidents on the Same Vessel

The system includes logic to identify when the same vessel has multiple legitimate incidents:

```javascript
// SAFEGUARD: Check for potential separate incidents on the same vessel
// If vessel names match perfectly but time is too different (more than 5 days apart)
// and locations are very different, these are likely separate incidents
if (vesselMatch && timeScore < 0.2 && spatialScore < 0.3) {
  log.info("Detected potentially separate incidents on the same vessel", {
    vesselName,
    timeScore,
    spatialScore,
    newDate: date,
    existingDate: incident.fields.date_time_utc,
    newLocation: `${latitude},${longitude}`,
    existingLocation: `${incident.fields.latitude},${incident.fields.longitude}`
  });
  
  // Override the same incident flag
  isSameIncident = false;
}
```

### Benefits

This multi-stage deduplication approach:

1. Prevents duplicate flash reports for the same incident
2. Ensures all sources of information about an incident are combined 
3. Maintains separate incidents when appropriate (e.g., multiple attacks on the same vessel)
4. Reduces alert fatigue for users

## Extending the System

### Adding New Sources

When adding new maritime incident sources:

1. Update the `getSourcePriority` function to include the new source
2. Consider if special handling is needed for source-specific data patterns
3. Test with dry run mode to evaluate matching without making changes

### Adjusting Thresholds

The system's sensitivity can be adjusted by:

1. Modifying the default `confidenceThreshold` (currently 0.7)
2. Changing the weight distribution in the similarity score calculation
3. Adjusting the maximum distance (50km) or time window (48 hours)

### Adding New Match Factors

To add new factors to the similarity calculation:

1. Create a new similarity function in the similarity-utils.js module
2. Incorporate the new score into the `calculateSimilarityScore` function
3. Adjust weights accordingly