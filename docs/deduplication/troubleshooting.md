# Deduplication System Troubleshooting Guide

This guide provides information for diagnosing and resolving issues with the cross-source deduplication system.

## Common Issues and Solutions

### No Matches Being Found

If the deduplication system isn't finding matches that you expect it to identify:

1. **Check the logs**: Look for `"Found X potential matches"` with `highConfidence` and `mediumConfidence` counts
2. **Review similarity scores**: Examine the detailed component scores to see where potential matches are falling short
3. **Test with lower threshold**: Run the function with a lower confidence threshold (e.g., `?confidenceThreshold=0.6`)
4. **Check data consistency**: Ensure time and location data is correctly formatted in raw_data records
5. **Examine match criteria**: Check the logs for "Match case" info messages to see which match criteria are being evaluated

### Incorrect Matches

If the system is incorrectly matching records that aren't related:

1. **Increase confidence threshold**: Raise the threshold to require more evidence (e.g., `?confidenceThreshold=0.8`)
2. **Examine similarity components**: Review the logs to see which factors are driving the high similarity score
3. **Adjust weights**: Consider updating the weight distribution in `calculateSimilarityScore`

### Records Being Re-merged Incorrectly

If records that were already merged are being incorrectly re-merged with different records:

1. **Check merge chains**: Verify that the system is properly tracking merge relationships with the logs showing "Following merge chain" messages
2. **Validate merge status fields**: Ensure records have the correct `merge_status` and `merged_into` fields set
3. **Look for timing issues**: Check if the incident processing is happening before deduplication has completed

### Process-raw-data Not Running After Deduplication

If the incident processing isn't being triggered after deduplication:

1. **Check PUBLIC_URL**: Ensure the `PUBLIC_URL` environment variable is set correctly in Netlify
2. **Review error logs**: Look for errors related to triggering the process function
3. **Test the process function**: Try manually triggering the process function to ensure it works
4. **Verify network access**: Ensure the function has network access to make the POST request

### Missing Required Fields

If deduplication fails due to missing fields:

1. **Check for required fields**: Ensure raw_data records have date, latitude, and longitude fields
2. **Validate coordinates**: Make sure latitude and longitude values are valid numbers
3. **Add data validation**: Consider enhancing the system to better validate and normalize input data

## Interpreting Logs

The deduplication system produces detailed logs for troubleshooting. Here's how to interpret key log entries:

### Configuration

```
INFO {"level":"info","msg":"Configuration","dryRun":false,"confidenceThreshold":0.7,"maxRecords":100}
```

Confirms the runtime configuration, including:
- `dryRun`: Whether changes are being applied or just simulated
- `confidenceThreshold`: The similarity score required for merging
- `maxRecords`: Maximum number of records processed

### Record Fetching

```
INFO {"level":"info","msg":"Retrieved 30 records for processing"}
INFO {"level":"info","msg":"Found 4 different sources","sources":["ICC","RECAAP","MDAT","UKMTO"]}
```

Shows the number of records retrieved and the distribution across sources.

### Similarity Scoring

```
INFO {"level":"info","msg":"Similarity score components","recordIds":["recA","recB"],"timeScore":0.95,"spatialScore":0.98,"vesselNameScore":0,"vesselIMOScore":0,"incidentTypeScore":0.8}
```

Provides detailed breakdown of similarity calculation between two records:
- `timeScore`: Time proximity (higher = closer in time)
- `spatialScore`: Spatial proximity (higher = closer in location)
- `vesselNameScore`: Vessel name similarity
- `vesselIMOScore`: IMO number match (0 or 1)
- `incidentTypeScore`: Incident type similarity

### Match Results

```
INFO {"level":"info","msg":"Found 12 potential matches","highConfidence":3,"mediumConfidence":9,"analyzedPairs":120}
```

Summarizes the match analysis:
- `highConfidence`: Matches above the high confidence threshold (≥0.8)
- `mediumConfidence`: Matches in the medium confidence range (0.6-0.8)
- `analyzedPairs`: Total number of record pairs compared

### Primary Record Determination

```
INFO {"level":"info","msg":"Primary record determination","record1":{...},"record2":{...}}
```

Shows the scoring used to determine which record becomes primary in a merge operation.

### Processing Results

```
INFO {"level":"info","msg":"Successfully merged records","primaryId":"recA","secondaryId":"recB"}
INFO {"level":"info","msg":"Cross-Source Deduplication complete","recordsAnalyzed":30,"mergesPerformed":3}
```

Confirms successful merges and provides a summary of the processing run.

## Testing the Deduplication System

### Using Dry Run Mode

To test the system without making changes:

```
curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/deduplicate-cross-source-background?dryRun=true"
```

This will identify potential matches but won't update any records, allowing you to review the results before making changes.

### Testing with Sample Data

1. Create test records in Airtable with controlled variations:
   - Same incident reported by different sources
   - Similar incidents with different vessels
   - Unrelated incidents with geographical proximity

2. Run the deduplication with these test cases and review the logs to see how the system interprets them.

### Testing Different Thresholds

Test the sensitivity of the system by varying the confidence threshold:

```
curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/deduplicate-cross-source-background?confidenceThreshold=0.65"
```

Try different thresholds (0.6, 0.7, 0.8) and analyze how the match results change.

## Monitoring and Maintenance

### Regular Log Review

- Check logs after each deduplication run to monitor performance
- Look for patterns in matching/non-matching records
- Track the number of merges performed over time

### System Tuning

Based on observed performance:

1. Adjust confidence thresholds if needed
2. Update similarity calculation weights
3. Modify source priorities based on data quality

### Data Quality Improvements

- Address any systematic data issues identified during deduplication
- Standardize date/time formats across sources
- Implement coordinate normalization if needed
- Work with data providers to improve data consistency