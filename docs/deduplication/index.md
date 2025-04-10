# Deduplication System

The MARA deduplication system operates at two levels to identify and merge duplicate maritime incident reports. This system enhances data quality, prevents duplicate alerts, and provides a comprehensive view of maritime incidents.

## Two-Layer Deduplication Approach

MARA implements a robust two-layer deduplication strategy:

1. **Raw Data Level (Cross-Source)**: Identifies and merges duplicate reports from different maritime reporting sources (RECAAP, UKMTO, MDAT, ICC) in the raw data table.

2. **Incident Level**: Prevents creating duplicate incidents when raw data deduplication didn't merge reports (for example, when reports come in at different times).

## Purpose

Maritime incidents are often reported by multiple organizations, with each source providing slightly different details about the same event. The deduplication system:

1. Identifies likely matches across different reporting sources
2. Determines which record is more complete/authoritative 
3. Merges complementary information
4. Maintains relationships between merged records

## Key Features

- **Multi-dimensional matching**: Uses time, location, vessel details, incident type, location names, and incident details for similarity scoring
- **Source-aware processing**: Accounts for differences in data completeness across reporting sources
- **Merge chain tracking**: Follows chains of merged records to prevent incorrect re-merging
- **Incident link preservation**: Maintains relationships to incidents in the incident table when merging records
- **Configurable confidence thresholds**: Adjustable scoring system to control merge aggressiveness
- **Complementary data merging**: Intelligently combines information from multiple sources
- **Source attribution preservation**: Maintains references to original sources
- **Background processing**: Runs automatically as scheduled Netlify functions

## System Architecture

The deduplication system consists of:

1. **Background Function**: `deduplicate-cross-source-background.js` scheduled in Netlify
2. **Utility Modules**:
   - `spatial-utils.js`: Geographical and temporal proximity calculations
   - `similarity-utils.js`: Text and entity matching algorithms
   - `deduplication-utils.js`: Record scoring and merging logic
3. **Integration with Reference Data**: Uses cached incident type data for better matching

## Workflow

1. **Record Selection**: Fetches recent raw_data records (last 30 days)
2. **Source Grouping**: Groups records by source to ensure cross-source comparisons only
3. **Merge Chain Verification**: Checks existing merge relationships to respect prior decisions
4. **Similarity Analysis**: 
   - Calculates time proximity (hours between incidents)
   - Calculates spatial proximity (kilometers between coordinates)
   - Compares vessel details when available
   - Analyzes incident type similarities
   - Checks location name matches
   - Identifies matching stolen items and incident details
5. **Match Identification**: Identifies potential matches above configurable threshold
6. **Primary Record Selection**: Determines most complete/authoritative record
7. **Data Merging**: Combines complementary information from matched records
8. **Record Updating**: Updates Airtable records with merged data and relationship links
9. **Processing Trigger**: Triggers the incident processing system after completion

## Similarity Scoring

Similarity scores are calculated on a scale of 0.0 to 1.0, with higher scores indicating higher confidence in a match:

- **Time Proximity**: 1.0 for same time, 0.0 for incidents ≥48 hours apart
- **Spatial Proximity**: 1.0 for same location, 0.0 for incidents ≥50km apart
- **Vessel Similarity**: Based on vessel name and IMO number matches
- **Incident Type Similarity**: Compares incident categorization

The overall similarity formula prioritizes time and location while accommodating source-specific data patterns:

```
totalScore = (timeScore * 0.4) + (spatialScore * 0.4) + (vesselScore * 0.1) + (incidentTypeScore * 0.1)
```

Matches with a score ≥0.7 are considered candidates for merging.

## Special Handling for Missing Data

The system is designed to handle source-specific data patterns:

- When both records lack vessel information (typical for ICC, MDAT, and UKMTO sources), a default vessel similarity score is assigned
- Records with matching IMO numbers are given maximum vessel similarity regardless of other factors
- Missing incident type data is handled gracefully with reference data lookups

## Data Fields

The deduplication system uses and updates the following fields in the raw_data table:

### Tracking Fields
- **merge_status**: Indicates merge status ("merged", "merged_into", or empty)
- **merged_into**: Links to primary record (for secondary records)
- **related_raw_data**: Links to secondary records (for primary records)
- **merge_score**: JSON metadata about the merge operation

### Standard Fields Used for Matching
- **date**: Incident date/time
- **latitude/longitude**: Geographical coordinates
- **vessel_name**: Vessel name (when available)
- **vessel_imo**: IMO number (when available)
- **incident_type_name**: Incident categorization
- **source**: Source system name

## Configuration

The deduplication system can be configured through environment variables and query parameters:

- **Scheduling**: Set in `netlify.toml` (default: runs hourly)
- **Confidence threshold**: Default 0.7, configurable via queryString
- **PUBLIC_URL**: Required for triggering the processing function
- **Record limit**: Default 100, configurable via queryString

## Process Integration

### Cross-Source Deduplication Workflow

The raw data deduplication system runs before incident processing:

1. `deduplicate-cross-source-background.js` processes raw data to identify and merge duplicates
2. Upon completion, it triggers `process-raw-data-background.js` to create incident records
3. This sequence ensures duplicates are merged before incident creation

### Incident-Level Deduplication Workflow

The incident-level deduplication occurs during record processing:

1. When `process-raw-data-background.js` processes a record, it first checks if the record is part of a merge chain
2. If it's part of a chain, it follows the chain to find the primary record and checks if it's linked to an incident
3. If no chain exists, it searches for similar existing incidents using enhanced similarity criteria:
   - Time and location proximity
   - Vessel details matching
   - Incident type comparison
   - Location name matching
   - Stolen items/details comparison
4. If a match is found, it updates the existing incident with any new information
5. The raw data record is linked to the existing incident rather than creating a duplicate
6. This prevents duplicate flash reports for the same incident, even when raw data comes from different sources at different times

## Manual Operation

For testing or manual operation, the function can be triggered with:

```sh
curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/deduplicate-cross-source-background"
```

With optional query parameters:
```sh
curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/deduplicate-cross-source-background?dryRun=true&confidenceThreshold=0.75"
```