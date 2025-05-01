/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from '../_shared/logger.ts';

/**
 * Required environment variables for the flash report function
 */
const requiredEnvVars = [
    'RESEND_API_KEY',
    'FLASH_REPORT_SECRET',
    'PUBLIC_SITE_URL',
    'ALERT_FROM_EMAIL'
] as const;

/**
 * Optional environment variables with defaults
 */
const optionalEnvVars = {
    'CLIENT_DOMAINS': '',
    'DEFAULT_LOGO': 'https://res.cloudinary.com/dwnh4b5sx/image/upload/v1741248008/branding/public/mara_logo_k4epmo.png',
    'DEFAULT_COMPANY_NAME': 'MARA Maritime Risk Analysis',
    'DEFAULT_PRIMARY_COLOR': '#234567',
    'DEFAULT_SECONDARY_COLOR': '#890123'
} as const;

/**
 * Validate required environment variables and set defaults for optional ones
 * @throws Error if any required variables are missing
 */
export function validateConfig(): void {
    const missing = requiredEnvVars.filter(key => !Deno.env.get(key));
    
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Set defaults for optional variables if not present
    Object.entries(optionalEnvVars).forEach(([key, defaultValue]) => {
        if (!Deno.env.get(key)) {
            log.info(`Setting default value for ${key}`);
            Deno.env.set(key, defaultValue);
        }
    });

    log.info('Flash report function configuration validated');
}

/**
 * Flash report settings
 */
export const settings = {
    tokenExpiryHours: 168, // 7 days
    maxRecipientsPerRequest: 50,
    maxRetries: 3,
    retryDelayMs: 1000,
} as const;

/**
 * Email configuration
 */
export const emailConfig = {
    defaultSubject: 'Maritime Flash Report',
    defaultFromName: 'MARA Alerts',
    tags: ['flash-report', 'maritime', 'incident'],
} as const;

/**
 * Get the configured email sender
 */
export function getEmailSender(): string {
    const fromEmail = Deno.env.get('ALERT_FROM_EMAIL');
    if (!fromEmail) {
        throw new Error('ALERT_FROM_EMAIL not configured');
    }
    return `${emailConfig.defaultFromName} <${fromEmail}>`;
}
