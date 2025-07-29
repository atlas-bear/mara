/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';
import { createHash } from 'https://deno.land/std@0.177.0/hash/mod.ts';

/**
 * Generate a secure token for flash report access
 * @param incidentId - The ID of the incident
 * @param expiryHours - Number of hours until token expires
 * @returns Object containing token and expiry date
 */
export function generateFlashReportToken(incidentId: string, expiryHours = 168): { token: string; expires: Date } {
    try {
        // Get the secret key from environment
        const secretKey = Deno.env.get('FLASH_REPORT_SECRET');
        if (!secretKey) {
            throw new Error('Flash report secret key not configured');
        }

        // Calculate expiry date
        const expires = new Date();
        expires.setHours(expires.getHours() + expiryHours);

        // Create a unique string combining incident ID, expiry, and a random component
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        const randomComponent = Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        // Combine components with the secret
        const dataToHash = `${incidentId}:${expires.toISOString()}:${randomComponent}:${secretKey}`;

        // Create hash
        const hash = createHash('sha256')
            .update(dataToHash)
            .toString('hex')
            .substring(0, 32); // Use first 32 chars for reasonable token length

        // Combine components into final token (excluding secret)
        const token = `${incidentId}.${expires.getTime()}.${randomComponent}.${hash}`;

        log.info('Generated flash report token', { incidentId, expires: expires.toISOString() });
        return { token, expires };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Error generating flash report token', { error: errorMessage, incidentId });
        throw new Error(`Failed to generate flash report token: ${errorMessage}`);
    }
}

/**
 * Verify a flash report access token
 * @param token - The token to verify
 * @returns The incident ID if token is valid
 * @throws Error if token is invalid or expired
 */
export function verifyFlashReportToken(token: string): string {
    try {
        // Get the secret key
        const secretKey = Deno.env.get('FLASH_REPORT_SECRET');
        if (!secretKey) {
            throw new Error('Flash report secret key not configured');
        }

        // Split token into components
        const [incidentId, expiryMs, randomComponent, providedHash] = token.split('.');
        
        if (!incidentId || !expiryMs || !randomComponent || !providedHash) {
            throw new Error('Invalid token format');
        }

        // Check expiry
        const expiryDate = new Date(parseInt(expiryMs));
        if (isNaN(expiryDate.getTime())) {
            throw new Error('Invalid expiry date in token');
        }

        if (expiryDate < new Date()) {
            throw new Error('Token has expired');
        }

        // Recreate hash
        const dataToHash = `${incidentId}:${expiryDate.toISOString()}:${randomComponent}:${secretKey}`;
        const expectedHash = createHash('sha256')
            .update(dataToHash)
            .toString('hex')
            .substring(0, 32);

        // Verify hash
        if (providedHash !== expectedHash) {
            throw new Error('Invalid token signature');
        }

        log.info('Verified flash report token', { incidentId });
        return incidentId;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Error verifying flash report token', { error: errorMessage });
        throw new Error(`Failed to verify flash report token: ${errorMessage}`);
    }
}

/**
 * Generate a public URL for accessing a flash report
 * @param incidentId - The ID of the incident
 * @param token - The access token
 * @param brand - Optional branding parameter
 * @returns The public URL
 */
export function getPublicFlashReportUrl(incidentId: string, token: string, brand?: string | null): string {
    try {
        const baseUrl = Deno.env.get('PUBLIC_SITE_URL');
        if (!baseUrl) {
            throw new Error('Public site URL not configured');
        }

        const url = new URL(`${baseUrl}/flash-report/${incidentId}`);
        url.searchParams.set('token', token);
        if (brand) {
            url.searchParams.set('brand', brand);
        }

        return url.toString();
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Error generating public flash report URL', { error: errorMessage, incidentId });
        throw new Error(`Failed to generate public flash report URL: ${errorMessage}`);
    }
}
