/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { renderEmailTemplate, getDefaultBranding } from '../_shared/email.ts';
import { generateFlashReportToken, getPublicFlashReportUrl } from '../_shared/tokenUtils.ts';
import { handleCors, successResponse, errorResponse, parseRequestBody } from '../_shared/http.ts';
import { validateConfig, settings, emailConfig } from './config.ts';

interface Recipient {
    email: string;
    name?: string;
    userId?: string;
}

interface FlashReportPayload {
    incidentId: string;
    recipients: Recipient[];
    customBranding?: {
        logo?: string;
        companyName?: string;
        colors?: {
            primary?: string;
            secondary?: string;
        };
    };
    testMode?: boolean;
}

/**
 * Determine if client branding should be used for a recipient's URL
 */
function shouldUseClientBranding(email: string): boolean {
    if (!email) return false;
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    
    const clientDomains = Deno.env.get('CLIENT_DOMAINS')?.split(',')
        .map(d => d.trim().toLowerCase())
        .filter(Boolean) || [];
    
    return clientDomains.includes(domain);
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    try {
        // Validate environment configuration
        validateConfig();

        // Parse and validate request
        const payload = await parseRequestBody<FlashReportPayload>(req, (body) => {
            if (!body.incidentId || !Array.isArray(body.recipients)) {
                return 'Invalid payload: incidentId and recipients array are required';
            }
            if (body.recipients.length === 0) {
                return 'At least one recipient is required';
            }
            if (body.recipients.length > settings.maxRecipientsPerRequest) {
                return `Maximum ${settings.maxRecipientsPerRequest} recipients allowed per request`;
            }
            if (!body.recipients.every(r => r.email && typeof r.email === 'string')) {
                return 'All recipients must have valid email addresses';
            }
            return true;
        });
        log.info('Processing flash report request', { incidentId: payload.incidentId });

        // Validate payload
        if (!payload.incidentId || !Array.isArray(payload.recipients) || payload.recipients.length === 0) {
            throw new Error('Invalid payload: incidentId and recipients are required');
        }

        // Fetch incident data
        const { data: incident, error: fetchError } = await supabaseAdmin
            .from('incident')
            .select(`
                *,
                vessels_involved:incident_vessel_link(
                    vessel_status_during_incident,
                    crew_impact,
                    vessel:vessel_id(
                        name,
                        type,
                        flag,
                        imo
                    )
                ),
                incident_type:incident_type_link(
                    type:incident_type_id(name)
                )
            `)
            .eq('id', payload.incidentId)
            .single();

        if (fetchError) {
            throw new Error(`Failed to fetch incident: ${fetchError.message}`);
        }
        if (!incident) {
            throw new Error(`Incident not found: ${payload.incidentId}`);
        }

        // Process each recipient
        const results = await Promise.all(payload.recipients.map(async (recipient) => {
            try {
                // Generate token with 7 days expiry
                const tokenData = generateFlashReportToken(payload.incidentId, settings.tokenExpiryHours);

                // Determine URL branding
                const brandParam = shouldUseClientBranding(recipient.email) ? 'client' : null;
                const publicUrl = getPublicFlashReportUrl(payload.incidentId, tokenData.token, brandParam);

                // Always use default MARA branding for emails
                const branding = getDefaultBranding();

                // Prepare email data
                const emailData = {
                    incident: {
                        ...incident,
                        vessels_involved: incident.vessels_involved.map((v: any) => ({
                            name: v.vessel?.name || 'Unknown Vessel',
                            type: v.vessel?.type || 'Unknown',
                            flag: v.vessel?.flag || 'Unknown',
                            imo: v.vessel?.imo || 'N/A',
                            crew_impact: v.crew_impact,
                            status: v.vessel_status_during_incident
                        })),
                        incident_type: incident.incident_type.map((t: any) => t.type?.name || 'Unknown')
                    },
                    branding,
                    publicUrl
                };

                // Queue email using our email service
                const { data: queuedEmail, error: queueError } = await supabaseAdmin
                    .from('email_queue')
                    .insert({
                        template_id: 'flash-report',
                        recipient_email: recipient.email,
                        recipient_user_id: recipient.userId,
                        category_id: 'flash-report',
                        subject: `${emailConfig.defaultSubject} - ${incident.location?.name || 'New Incident'}`,
                        variables: {
                            ...emailData,
                            recipient_name: recipient.name
                        },
                        priority: 'high',
                        metadata: {
                            incident_id: payload.incidentId,
                            token: tokenData.token,
                            public_url: publicUrl,
                            test_mode: payload.testMode || false
                        },
                        rate_limit_key: `flash_report_${incident.id}`,
                        rate_limit_window: 'PT1H',  // 1 hour
                        rate_limit_count: 100       // Max 100 per hour
                    })
                    .select()
                    .single();

                if (queueError) {
                    throw new Error(`Failed to queue email: ${queueError.message}`);
                }

                log.info('Flash report email queued successfully', { 
                    recipient: recipient.email,
                    incidentId: payload.incidentId,
                    queueId: queuedEmail.id
                });

                return {
                    email: recipient.email,
                    status: 'queued',
                    queueId: queuedEmail.id,
                    publicUrl
                };

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log.error('Error queueing flash report email', {
                    error: errorMessage,
                    recipient: recipient.email,
                    incidentId: payload.incidentId
                });

                return {
                    email: recipient.email,
                    status: 'failed',
                    error: errorMessage
                };
            }
        }));

        // Trigger queue processing
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-email-queue`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            }
        }).catch(error => {
            // Log but don't fail if queue processing trigger fails
            log.error('Failed to trigger queue processing:', error);
        });

        // Return results
        return successResponse({
            message: 'Flash report emails queued successfully',
            results
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return errorResponse('Failed to process flash report', errorMessage);
    }
});
