/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from '../_shared/logger.ts';

/**
 * Deduplication settings
 */
export const settings = {
    // Minimum similarity score required to consider records as duplicates
    confidenceThreshold: 0.7,

    // Maximum number of records to process in a single run to avoid timeouts
    maxRecordsToProcess: 500,

    // Number of days to look back for potential duplicates
    lookbackDays: 30,

    // Thresholds for confidence level categorization
    highConfidenceThreshold: 0.8,
} as const;

/**
 * Summary of deduplication run
 */
export interface DeduplicationSummary {
    recordsAnalyzed: number;
    potentialMatchesChecked: number;
    highConfidenceMatches: number;
    mediumConfidenceMatches: number;
    mergesAttempted: number;
    mergesSucceeded: number;
    mergeErrors: number;
}

/**
 * Get the lookback date based on current settings
 */
export function getLookbackDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() - settings.lookbackDays);
    return date;
}

/**
 * Validate a deduplication summary
 */
export function validateSummary(summary: DeduplicationSummary): boolean {
    // Ensure all required fields are present and have valid values
    const requiredFields = [
        'recordsAnalyzed',
        'potentialMatchesChecked',
        'highConfidenceMatches',
        'mediumConfidenceMatches',
        'mergesAttempted',
        'mergesSucceeded',
        'mergeErrors'
    ] as const;

    for (const field of requiredFields) {
        if (typeof summary[field] !== 'number' || summary[field] < 0) {
            log.error('Invalid summary field', { field, value: summary[field] });
            return false;
        }
    }

    // Validate relationships between numbers
    if (summary.mergesSucceeded > summary.mergesAttempted) {
        log.error('Invalid summary: more successes than attempts', summary);
        return false;
    }

    if (summary.mergesAttempted > summary.potentialMatchesChecked) {
        log.error('Invalid summary: more merge attempts than matches checked', summary);
        return false;
    }

    if ((summary.highConfidenceMatches + summary.mediumConfidenceMatches) > summary.potentialMatchesChecked) {
        log.error('Invalid summary: more matches than checks', summary);
        return false;
    }

    return true;
}
