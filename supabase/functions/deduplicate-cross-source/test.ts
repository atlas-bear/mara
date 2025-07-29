/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { assertEquals, assertExists } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { settings, validateSummary, type DeduplicationSummary } from './config.ts';

// Mock raw data records for testing
const mockRawData = [
    {
        id: 'rec1',
        source: 'source1',
        title: 'Incident at Location A',
        description: 'Detailed description of incident at Location A',
        date: new Date().toISOString(),
        merge_status: null
    },
    {
        id: 'rec2',
        source: 'source2',
        title: 'Event near Location A',
        description: 'Similar incident occurred at Location A',
        date: new Date().toISOString(),
        merge_status: null
    },
    {
        id: 'rec3',
        source: 'source1',
        title: 'Different Incident',
        description: 'Unrelated incident at different location',
        date: new Date().toISOString(),
        merge_status: null
    }
];

// Mock successful response from Supabase
const mockSupabaseResponse = {
    data: mockRawData,
    error: null
};

Deno.test('Deduplication Configuration', async (t) => {
    await t.step('settings are properly defined', () => {
        assertExists(settings.confidenceThreshold);
        assertExists(settings.maxRecordsToProcess);
        assertExists(settings.lookbackDays);
        assertExists(settings.highConfidenceThreshold);

        // Validate threshold relationships
        assertEquals(settings.confidenceThreshold <= settings.highConfidenceThreshold, true);
        assertEquals(settings.confidenceThreshold > 0 && settings.confidenceThreshold < 1, true);
    });

    await t.step('validateSummary validates correctly', () => {
        // Valid summary
        const validSummary: DeduplicationSummary = {
            recordsAnalyzed: 10,
            potentialMatchesChecked: 45,
            highConfidenceMatches: 2,
            mediumConfidenceMatches: 3,
            mergesAttempted: 5,
            mergesSucceeded: 4,
            mergeErrors: 1
        };
        assertEquals(validateSummary(validSummary), true);

        // Invalid: more successes than attempts
        const invalidSummary1: DeduplicationSummary = {
            ...validSummary,
            mergesSucceeded: 6,
            mergesAttempted: 5
        };
        assertEquals(validateSummary(invalidSummary1), false);

        // Invalid: more matches than checks
        const invalidSummary2: DeduplicationSummary = {
            ...validSummary,
            potentialMatchesChecked: 4,
            highConfidenceMatches: 3,
            mediumConfidenceMatches: 3
        };
        assertEquals(validateSummary(invalidSummary2), false);

        // Invalid: negative numbers
        const invalidSummary3: DeduplicationSummary = {
            ...validSummary,
            mergeErrors: -1
        };
        assertEquals(validateSummary(invalidSummary3), false);
    });
});

// Add type for mocked Supabase client
// Type for Supabase response
type SupabaseResponse = {
    data: any[] | null;
    error: Error | null;
};

// Type for chained query methods
type QueryChain = {
    limit: (n: number) => SupabaseResponse;
    order: (column: string, options?: { ascending: boolean }) => { limit: (n: number) => SupabaseResponse };
    or: (conditions: string) => { order: (column: string, options?: { ascending: boolean }) => { limit: (n: number) => SupabaseResponse } };
    gte: (column: string, value: string) => { or: (conditions: string) => { order: (column: string, options?: { ascending: boolean }) => { limit: (n: number) => SupabaseResponse } } };
    eq: (column: string, value: string) => SupabaseResponse;
};

// Simplified mock client that matches our usage
interface MockSupabaseClient {
    from: (table: string) => {
        select: (columns?: string) => Partial<QueryChain>;
        update: (data: Record<string, unknown>) => Partial<QueryChain>;
    };
}

declare global {
    var supabaseAdmin: MockSupabaseClient;
}

// Mock request for testing the handler
const mockRequest = (method = 'POST'): Request => {
    return new Request('http://localhost', {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    });
};

Deno.test('Deduplication Handler', async (t) => {
    await t.step('handles CORS preflight', async () => {
        const request = mockRequest('OPTIONS');
        const response = await fetch(request);
        assertEquals(response.status, 200);
        assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    });

    await t.step('processes records successfully', async () => {
        // Mock Supabase client
        const originalSupabase = supabaseAdmin;
        supabaseAdmin = {
            from: () => ({
                select: () => ({
                    gte: () => ({
                        or: () => ({
                            order: () => ({
                                limit: () => mockSupabaseResponse
                            })
                        })
                    }),
                    eq: () => ({ data: null, error: null })
                }),
                update: () => ({
                    eq: () => ({ data: null, error: null })
                })
            })
        };

        try {
            const request = mockRequest();
            const response = await fetch(request);
            assertEquals(response.status, 200);

            const data = await response.json();
            assertEquals(data.success, true);
            assertExists(data.data.summary);
            assertExists(data.data.config);

            // Verify config matches settings
            assertEquals(data.data.config.confidenceThreshold, settings.confidenceThreshold);
            assertEquals(data.data.config.maxRecordsToProcess, settings.maxRecordsToProcess);
            assertEquals(data.data.config.lookbackDays, settings.lookbackDays);

        } finally {
            supabaseAdmin = originalSupabase;
        }
    });

    await t.step('handles database errors', async () => {
        // Mock Supabase client with error
        const originalSupabase = supabaseAdmin;
        supabaseAdmin = {
            from: () => ({
                select: () => ({
                    gte: () => ({
                        or: () => ({
                            order: () => ({
                                limit: () => ({ data: null, error: new Error('Database error') })
                            })
                        })
                    }),
                    eq: () => ({ data: null, error: new Error('Database error') })
                }),
                update: () => ({
                    eq: () => ({ data: null, error: new Error('Database error') })
                })
            })
        };

        try {
            const request = mockRequest();
            const response = await fetch(request);
            assertEquals(response.status, 500);

            const data = await response.json();
            assertEquals(data.success, false);
            assertExists(data.error.message);
            assertEquals(data.error.message.includes('Database error'), true);

        } finally {
            supabaseAdmin = originalSupabase;
        }
    });
});
