# Data Processing System

The MARA data processing system transforms deduplicated raw incident data into structured, enriched incident records through intelligent analysis and standardization. This critical pipeline stage creates the high-quality incident data that powers MARA's reporting and analytics capabilities.

## Processing Functions

The data processing stage consists of two main functions that work in sequence:

1. **`process-raw-data-background.js`**: Processes individual raw data records into structured incident records
2. **`process-incidents.js`**: Performs batch processing of incidents and additional post-processing tasks

## Processing Workflow

The complete data processing workflow consists of:

1. **Raw Data Selection**: Identify unprocessed records from the `raw_data` table
2. **Processing Status Update**: Mark selected record as "Processing"
3. **Data Normalization**: Standardize data formats and clean input
4. **AI-Powered Analysis**: Generate enriched analysis using Claude AI
5. **Incident Creation**: Create structured incident record
6. **Vessel Processing**: Create or link to vessel records
7. **Related Data Creation**: Create reference entries for incident attributes
8. **Processing Completion**: Mark raw data as processed and link to created incident
9. **Continuation**: Check for more records to process

## Detailed Process Flow

### Raw Data Selection

The `process-raw-data-background.js` function selects unprocessed records using this criteria:

```javascript
const filterByFormula = "AND(NOT({has_incident}), OR(NOT({processing_status}), {processing_status} = 'pending'))";
```

This ensures that:
- Only records without existing incidents are processed
- Only records that aren't already being processed are selected

### AI-Powered Enrichment

A key feature of the processing system is the integration with Claude AI to enhance incident data:

1. **Context Assembly**: Builds a detailed prompt with incident information
2. **API Integration**: Calls Claude with specialized instructions
3. **Analysis Generation**: Creates insightful analysis of the maritime incident
4. **Data Extraction**: Extracts structured data about weapons, attackers, stolen items, etc.
5. **Title Generation**: Creates a concise but descriptive incident title

The system uses a carefully designed prompt that instructs Claude to:

- Create a concise incident title (max 10 words)
- Extract location information if missing
- Identify weapons mentioned in the description
- Provide insightful analysis (1-2 paragraphs)
- Create actionable security recommendations (2-3 bullet points)
- Extract specific details in structured format
  - Weapons used
  - Number of attackers
  - Items stolen
  - Response type
  - Authorities notified

### Standardization Through Reference Data

The system maintains standardized categorization through reference tables:

1. **Incident Types**: The system matches to known incident types or creates new ones
2. **Weapons**: Standardized weapon categories for consistent reporting
3. **Items Stolen**: Categorization of stolen property
4. **Response Types**: Standard response classifications
5. **Authorities Notified**: Standardized authority references

For each reference category, the system:
1. Checks if the item exists in the reference table
2. Creates it if it doesn't exist
3. Links the incident to the reference items

### Vessel Data Processing

The system handles vessel information with special care:

1. **Vessel Lookup**: Checks if vessel exists by name or IMO
2. **Vessel Creation**: Creates new vessel record if needed
3. **Incident-Vessel Linking**: Creates relationship in the `incident_vessel` join table
4. **Status Determination**: Determines vessel status during incident:
   - Parses status from raw data
   - Extracts from description if not explicit
   - Maps to standardized values (Anchored, Underway, Moored, etc.)

### Processing Continuation

To handle large volumes efficiently, the system implements a self-triggering mechanism:

```javascript
// Check if more records exist to process
const moreRecords = await checkMoreRecordsExist(rawDataUrl, headers);

if (moreRecords) {
  // Trigger another processing run via API call
  try {
    const siteUrl = process.env.URL || "https://mara-v2.netlify.app";
    await axios.post(`${siteUrl}/.netlify/functions/process-raw-data-background`);
  } catch (triggerError) {
    console.error("Failed to trigger next processing job", triggerError.message);
  }
}
```

This allows continuous processing until all raw data has been processed.

## Error Handling and Resilience

The processing system implements robust error handling:

1. **Transaction Isolation**: Each record is processed independently
2. **State Tracking**: Processing status is updated at each stage
3. **Detailed Logging**: Comprehensive error information for troubleshooting
4. **Graceful Degradation**: Falls back to simpler processing if advanced features fail
5. **Retry Mechanism**: Failed records can be reprocessed

## Scheduling and Execution

The processing function is scheduled to run after collection and deduplication:

```toml
[functions."process-incidents"]
schedule = "25,55 * * * *"  # 25 and 55 minutes past the hour
```

Additionally, it's triggered on-demand after the deduplication function completes.

## System Extensions

The processing system can be extended in several ways:

1. **Additional AI Enrichment**: Adding more advanced analysis capabilities
2. **Enhanced Categorization**: Expanding reference data categories
3. **Custom Processing Rules**: Adding source-specific or region-specific processing
4. **Improved Vessel Linking**: Enhanced vessel identification and metadata extraction
5. **Post-Processing Analysis**: Additional intelligence generation after incident creation

## Technical Considerations

### Performance Optimization

The processing system optimizes performance through:

1. **Batched API Calls**: Reduces latency by combining related operations
2. **Incremental Processing**: Processes records in small batches
3. **Cached Lookups**: Minimizes redundant database queries
4. **Self-Throttling**: Prevents resource exhaustion during peak loads

### Data Quality Assurance

Several mechanisms ensure data quality:

1. **Validation**: Input data is validated before processing
2. **Normalization**: Dates, coordinates, and text are standardized
3. **AI Review**: Claude provides a secondary check on data consistency
4. **Reference Standards**: Use of reference tables ensures consistent categorization
5. **Field Verification**: Required fields are verified before saving

## Monitoring and Troubleshooting

The processing system provides comprehensive monitoring:

1. **Progress Logging**: Detailed logs of each processing stage
2. **Status Tracking**: Record status in the `raw_data` table
3. **Performance Metrics**: Execution time and resource usage tracking
4. **Error Categorization**: Specific error types for targeted fixing
5. **Debugging Tools**: Special debugging endpoints for testing