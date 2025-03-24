# Data Pipeline Overview

The MARA data pipeline is a critical component that automates the collection, processing, and enrichment of maritime incident data from multiple authoritative sources. This system transforms diverse, unstructured reports into standardized, structured incident records that power MARA's analytics and reporting capabilities.

## System Architecture

The MARA data pipeline consists of three primary stages, each implemented as Netlify serverless functions:

1. **Data Collection** - Source-specific functions that gather raw incident data
2. **Cross-Source Deduplication** - Identifies and merges duplicate reports across sources
3. **Data Processing** - Transforms raw data into structured incident records

All stages are orchestrated through scheduled execution in Netlify, forming an automated end-to-end pipeline.

## Data Collection Stage

The collection stage is implemented as a set of source-specific functions that interface with different maritime reporting organizations:

| Function | Source | Description |
|----------|--------|-------------|
| `collect-recaap.js` | ReCAAP | Regional Cooperation Agreement on Combating Piracy and Armed Robbery against Ships in Asia |
| `collect-ukmto.js` | UKMTO | UK Maritime Trade Operations |
| `collect-mdat.js` | MDAT-GoG | Maritime Domain Awareness for Trade - Gulf of Guinea |
| `collect-icc.js` | ICC-IMB | International Chamber of Commerce - International Maritime Bureau |
| `collect-cwd.js` | CWD | Commercial Wisdom Database |

Each collection function:
- Connects to the respective source API or scrapes the source website
- Extracts incident information in the source's native format
- Standardizes timestamps, coordinates, and key fields
- Stores raw data in the `raw_data` table in Airtable
- Preserves the original source data structure in the `raw_json` field

## Cross-Source Deduplication Stage

The `deduplicate-cross-source-background.js` function runs after collection to identify and merge duplicate reports:

- Analyzes recently collected raw data across different sources
- Performs multi-dimensional similarity scoring (time, location, vessel, incident type)
- Identifies potential matches and selects primary records
- Merges complementary information while preserving source attribution
- Sets up relationships between merged records

For detailed information on the deduplication system, see the [Cross-Source Deduplication documentation](../deduplication/overview.md).

## Data Processing Stage

The final stage transforms deduplicated raw data into standardized incident records:

1. **Raw Data Selection** - `process-raw-data-background.js` selects unprocessed raw data records
2. **Data Enrichment** - Enhances data with LLM-powered analysis
3. **Incident Creation** - Creates structured incident records in the `incident` table
4. **Vessel Association** - Links incidents to vessel records through the `incident_vessel` join table
5. **Reference Data Management** - Maintains reference data for incident types, weapons, etc.

### Data Enrichment

The processing stage incorporates AI-based enrichment using Claude, which:
- Generates concise, descriptive titles for incidents
- Extracts location information when not explicitly provided
- Identifies weapons used, number of attackers, and items stolen
- Creates insightful analysis and security recommendations
- Categorizes incidents based on description content

### Reference Data Management

The system maintains several reference data tables for standardization:
- `incident_type` - Categorization of maritime security events
- `weapons` - Types of weapons used in incidents
- `items_stolen` - Categories of items taken during incidents
- `response_type` - Types of responses to incidents
- `authorities_notified` - Organizations notified about incidents

## Data Flow

The complete data flow through the pipeline is:

1. **Data Collection**: Source-specific collectors run on schedule (every 30 minutes)
2. **Raw Data Storage**: Collected data is stored in the `raw_data` table
3. **Deduplication**: The deduplication function runs (hourly)
4. **Processing Trigger**: Deduplication triggers the processing function
5. **Data Processing**: Raw data is processed into incident records
6. **Enrichment**: Incident data is enriched with AI-generated analysis
7. **Standardization**: Data is standardized using reference tables
8. **Flash Reports**: New incidents trigger flash report generation
9. **Weekly Reports**: Incidents are aggregated into weekly reports

## Scheduling

The pipeline components are scheduled in Netlify to ensure efficient processing:

```
[functions."collect-recaap"]
schedule = "0,30 * * * *"  # Every 30 minutes

[functions."collect-ukmto"]
schedule = "5,35 * * * *"  # 5 and 35 minutes past the hour

[functions."collect-mdat"]
schedule = "15,45 * * * *"  # 15 and 45 minutes past the hour

[functions."collect-icc"]
schedule = "20,50 * * * *"  # 20 and 50 minutes past the hour

[functions."deduplicate-cross-source-background"]
schedule = "28 * * * *"    # 28 minutes past every hour
background = true

[functions."process-incidents"]
schedule = "25,55 * * * *"  # 25 and 55 minutes past the hour
```

The staggered scheduling prevents resource contention and ensures the pipeline stages execute in the proper sequence.

## System Benefits

This automated data pipeline delivers several key benefits:

1. **Comprehensive Coverage**: Collects data from all major maritime reporting organizations
2. **Data Quality**: Eliminates duplicates and standardizes information across sources
3. **Enriched Analysis**: Adds value through AI-powered incident analysis
4. **Operational Efficiency**: Minimizes manual data entry and processing
5. **Timeliness**: Provides near real-time incident updates
6. **Scalability**: Handles increasing data volumes and additional sources
7. **Flexibility**: Easily adaptable to accommodate new data formats or sources