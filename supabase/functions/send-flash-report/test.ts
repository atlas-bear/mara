/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { assertEquals, assertMatch } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { validateConfig, settings, emailConfig } from './config.ts';

// Mock environment variables for testing
const mockEnv = {
    'RESEND_API_KEY': 'test_key',
    'FLASH_REPORT_SECRET': 'test_secret',
    'PUBLIC_SITE_URL': 'https://test.example.com',
    'ALERT_FROM_EMAIL': 'test@example.com',
    'CLIENT_DOMAINS': 'client1.com,client2.com',
};

// Helper to set mock environment
function setMockEnv() {
    Object.entries(mockEnv).forEach(([key, value]) => {
        Deno.env.set(key, value);
    });
}

// Helper to clear mock environment
function clearMockEnv() {
    Object.keys(mockEnv).forEach(key => {
        Deno.env.delete(key);
    });
}

Deno.test('Flash Report Configuration', async (t) => {
    await t.step('validateConfig succeeds with all required variables', () => {
        setMockEnv();
        validateConfig(); // Should not throw
        clearMockEnv();
    });

    await t.step('validateConfig throws with missing variables', () => {
        clearMockEnv();
        try {
            validateConfig();
            throw new Error('Should have thrown');
        } catch (error: unknown) {
            if (error instanceof Error) {
                assertMatch(error.message, /Missing required environment variables/);
            } else {
                throw new Error('Unexpected error type');
            }
        }
    });

    await t.step('settings are properly defined', () => {
        assertEquals(typeof settings.tokenExpiryHours, 'number');
        assertEquals(typeof settings.maxRecipientsPerRequest, 'number');
        assertEquals(typeof settings.maxRetries, 'number');
        assertEquals(typeof settings.retryDelayMs, 'number');
    });

    await t.step('email config is properly defined', () => {
        assertEquals(typeof emailConfig.defaultSubject, 'string');
        assertEquals(typeof emailConfig.defaultFromName, 'string');
        assertEquals(Array.isArray(emailConfig.tags), true);
    });
});

// Mock request for testing the handler
const mockRequest = (body: unknown): Request => {
    return new Request('http://localhost', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
};

// Mock successful Supabase response
const mockIncident = {
    id: 'test-incident-id',
    title: 'Test Incident',
    description: 'Test description',
    location: { name: 'Test Location' },
    vessels_involved: [{
        vessel: {
            name: 'Test Vessel',
            type: 'Cargo',
            flag: 'Test Flag',
            imo: '1234567'
        },
        vessel_status_during_incident: 'Underway',
        crew_impact: 'No injuries'
    }],
    incident_type: [{
        type: { name: 'Test Type' }
    }]
};

// Mock successful Resend API response
const mockResendResponse = {
    id: 'test-email-id',
    from: 'test@example.com',
    to: ['recipient@example.com'],
    subject: 'Test Subject',
    status: 'sent'
};

Deno.test('Flash Report Handler', async (t) => {
    await t.step('handles valid request', async () => {
        setMockEnv();

        // Mock fetch for Resend API
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
            const url = input instanceof Request ? input.url : input.toString();
            
            if (url.includes('api.resend.com')) {
                return new Response(JSON.stringify(mockResendResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Pass through other requests
            return originalFetch(input, init);
        };

        const request = mockRequest({
            incidentId: 'test-incident-id',
            recipients: [{ email: 'test@example.com' }]
        });

        try {
            const response = await fetch(request);
            assertEquals(response.status, 200);

            const data = await response.json();
            assertEquals(data.success, true);
            assertEquals(Array.isArray(data.data.results), true);
        } finally {
            globalThis.fetch = originalFetch;
            clearMockEnv();
        }
    });

    await t.step('handles invalid request', async () => {
        setMockEnv();

        const request = mockRequest({
            // Missing required fields
        });

        const response = await fetch(request);
        assertEquals(response.status, 400);

        const data = await response.json();
        assertEquals(data.success, false);
        assertEquals(typeof data.error.message, 'string');

        clearMockEnv();
    });
});
