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

### Handling Missing Data

The system is designed to handle missing data gracefully:

```javascript
// Special handling for missing vessel data
const bothMissingVesselInfo = (!fields1.vessel_name && !fields2.vessel_name);
const vesselScore = vesselIMOScore === 1 ? 1 : 
                   bothMissingVesselInfo ? 0.7 : vesselNameScore;
```

### Weight Distribution for Similarity

The system prioritizes time and location data over vessel information:

```javascript
// Weight distribution: 40% time, 40% location, 10% vessel, 10% incident type
const totalScore =
  timeScore * 0.4 +
  spatialScore * 0.4 +
  vesselScore * 0.1 +
  incidentTypeScore * 0.1;
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