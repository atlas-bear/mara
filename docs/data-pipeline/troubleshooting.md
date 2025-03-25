# Data Pipeline Troubleshooting Guide

This guide provides solutions for common issues encountered with the MARA data pipeline and instructions for monitoring and maintaining the system.

## Common Issues and Solutions

### Collection Issues

#### No Data Being Collected from a Source

If a specific collection function is not gathering any data:

1. **Check Source Availability**: Verify that the source's API or website is operational
2. **Examine Function Logs**: Look for connection errors or authentication issues
3. **Verify API Credentials**: Ensure API keys are valid and properly set in environment variables
4. **Check Rate Limiting**: Determine if the source has imposed rate limits
5. **Test Manual Collection**: Attempt a manual trigger of the collection function

#### Duplicate Raw Data Entries

If you notice duplicate entries in the `raw_data` table:

1. **Check Source Reference IDs**: Ensure the source is providing unique reference IDs
2. **Review Deduplication Logic**: Verify the source-specific deduplication logic
3. **Examine Hash Generation**: Ensure content hashing is correctly implemented
4. **Check for API Changes**: Source API changes may affect how references are generated
5. **Clear Hash Cache**: Use the `clear-all-hashes.js` function to reset hash caching

### Processing Issues

#### Raw Data Not Being Processed

If raw data is being collected but not processed into incidents:

1. **Check Processing Status**: Verify that records don't have the `processing_status` set to "Processing" (stuck records)
2. **Review Filter Formula**: Ensure the selection formula in `process-raw-data-background.js` is working correctly
3. **Examine Function Logs**: Look for errors during processing
4. **Verify Claude API Key**: Ensure the Claude API key is valid for LLM enrichment
5. **Check Environment Variables**: Verify all required environment variables are set

#### Poor Quality Incident Analysis

If the AI-generated analysis is low quality:

1. **Review Claude Prompts**: Check and refine the prompts in `process-raw-data-background.js`
2. **Examine Raw Data Quality**: Poor input data can lead to poor analysis
3. **Verify Claude Model**: Ensure the function is using the correct Claude model version
4. **Check Token Limits**: Ensure prompts and responses are within token limits
5. **Sample Analysis**: Review logs to see what Claude is generating

#### Missing Vessel Information

If vessel data is not being properly linked to incidents:

1. **Check Raw Data**: Verify that source data includes vessel information
2. **Review Vessel Join Logic**: Examine the vessel linking code
3. **Check Vessel Lookup**: Ensure vessel lookup by name and IMO is working
4. **Examine Vessel Creation**: Verify new vessels are being created properly
5. **Reconcile Vessel Names**: Check for inconsistent vessel naming across sources

### Deduplication Issues

#### Missed Duplicate Incidents

If the system fails to identify duplicates:

1. **Review Confidence Threshold**: Adjust the similarity threshold in the deduplication function
2. **Check Time Window**: Ensure the time window is appropriate (default: 48 hours)
3. **Examine Distance Calculation**: Verify spatial proximity calculation
4. **Review Vessel Matching**: Check vessel name and IMO matching logic
5. **Update Weights**: Adjust the weights in the similarity score calculation

#### Incorrect Merging

If unrelated incidents are incorrectly merged:

1. **Increase Confidence Threshold**: Raise the threshold for required similarity
2. **Examine Similarity Components**: Determine which factors are causing high similarity
3. **Add Additional Constraints**: Implement additional rules for deduplication
4. **Use Dry Run Mode**: Test changes with the dry run mode before applying

For detailed deduplication troubleshooting, see the [Deduplication Troubleshooting Guide](../deduplication/troubleshooting.md).

## Monitoring the Pipeline

### Key Logs to Monitor

The MARA data pipeline produces several important log patterns to monitor:

1. **Collection Success Indicators**:
   ```
   Successfully collected X incidents from SOURCE
   ```

2. **Deduplication Activity**:
   ```
   Found X potential matches","highConfidence":Y,"mediumConfidence":Z,"analyzedPairs":W
   ```

3. **Processing Progress**:
   ```
   Found record to process: {id: X, title: Y}
   ```
   
4. **LLM Integration Status**:
   ```
   Successfully processed Claude response with generated title
   ```

### Health Check Functions

Several utility functions can be used to check system health:

1. **`check-env.js`**: Verifies that required environment variables are set
2. **`monitor-runs.js`**: Shows recent collection and processing runs
3. **`check-cache.js`**: Verifies that caching is operational

### Manual Triggers

For manual testing or intervention, you can trigger pipeline stages directly:

1. **Collection**:
   ```bash
   curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/collect-recaap"
   ```

2. **Deduplication**:
   ```bash
   curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/deduplicate-cross-source-background?dryRun=true"
   ```

3. **Processing**:
   ```bash
   curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/process-raw-data-background"
   ```

### Key Metrics to Track

Monitor these metrics to ensure pipeline health:

1. **Collection Success Rate**: Percentage of successful source collection runs
2. **Deduplication Accuracy**: Number of correct merges vs. incorrect merges
3. **Processing Completion Time**: Average time to process a raw data record
4. **LLM Enrichment Success**: Percentage of records successfully enriched with AI
5. **Pipeline Throughput**: Number of incidents processed per hour

## Performance Tuning

### Collection Optimization

To optimize collection performance:

1. **Adjust Collection Frequency**: Modify the schedule in `netlify.toml` to match source update patterns
2. **Implement Incremental Collection**: Only fetch new records since last successful run
3. **Optimize API Requests**: Use filtering and field selection to reduce data transferred
4. **Implement Caching**: Cache API responses where appropriate
5. **Use Batch Processing**: Process records in batches rather than individually

### Processing Optimization

To optimize incident processing:

1. **Adjust Batch Size**: Modify the number of records processed in each function invocation
2. **Optimize LLM Prompts**: Refine prompts to reduce token usage
3. **Implement Parallel Processing**: Process multiple records simultaneously
4. **Cache Reference Data**: Reduce database lookups for common reference items
5. **Optimize Database Queries**: Minimize Airtable API calls with batched operations

## Recovery Procedures

### Handling Stuck Records

If records get stuck in "Processing" status:

1. Run this Airtable formula to identify stuck records:
   ```
   AND({processing_status} = 'Processing', IS_BEFORE({last_processed}, DATEADD(NOW(), -1, 'hours')))
   ```

2. Update stuck records to reset their status:
   ```javascript
   fields: {
     processing_status: 'pending',
     processing_notes: `Reset from stuck state at ${new Date().toISOString()}`
   }
   ```

### Recovering from Failed Runs

If a pipeline stage fails completely:

1. **Check Environment Variables**: Verify all required variables are set
2. **Review Function Logs**: Identify the root cause of the failure
3. **Fix Underlying Issues**: Address any API, permission, or code issues
4. **Reset Processing Status**: Update any affected records
5. **Trigger Manual Run**: Manually trigger the failed pipeline stage

### Data Correction

If incorrect data has been processed:

1. **Identify Affected Records**: Use Airtable views to isolate problematic records
2. **Correct Raw Data**: Fix issues in the raw data if necessary
3. **Update Processing Status**: Set processing_status to "pending" to reprocess
4. **Clear Cached Data**: Clear any cached versions of the records
5. **Trigger Reprocessing**: Manually trigger the processing function