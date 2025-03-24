# Cross-Source Deduplication System

The MARA cross-source deduplication system identifies and merges duplicate maritime incident reports from different maritime reporting sources (RECAAP, UKMTO, MDAT, ICC). This system enhances data quality by combining complementary information from multiple sources into a single, comprehensive incident record.

## Purpose

Maritime incidents are often reported by multiple organizations, with each source providing slightly different details about the same event. The deduplication system:

1. Identifies likely matches across different reporting sources
2. Determines which record is more complete/authoritative 
3. Merges complementary information
4. Maintains relationships between merged records

## Key Features

- **Multi-dimensional matching**: Uses time, location, vessel details, and incident type for similarity scoring
- **Source-aware processing**: Accounts for differences in data completeness across reporting sources
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
3. **Similarity Analysis**: 
   - Calculates time proximity (hours between incidents)
   - Calculates spatial proximity (kilometers between coordinates)
   - Compares vessel details when available
   - Analyzes incident type similarities
4. **Match Identification**: Identifies potential matches above configurable threshold
5. **Primary Record Selection**: Determines most complete/authoritative record
6. **Data Merging**: Combines complementary information from matched records
7. **Record Updating**: Updates Airtable records with merged data and relationship links
8. **Processing Trigger**: Triggers the incident processing system after completion

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

The deduplication system runs before incident processing:

1. `deduplicate-cross-source-background.js` processes raw data to identify and merge duplicates
2. Upon completion, it triggers `process-raw-data-background.js` to create incident records
3. This sequence ensures duplicates are merged before incident creation

## Manual Operation

For testing or manual operation, the function can be triggered with:

```sh
curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/deduplicate-cross-source-background"
```

With optional query parameters:
```sh
curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/deduplicate-cross-source-background?dryRun=true&confidenceThreshold=0.75"
```