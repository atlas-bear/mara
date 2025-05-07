import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/http.ts';
import { getCurrentReportingWeek, getYearWeek } from '../_shared/dates.ts';

interface UserData {
    email: string;
    first_name: string | null;
    last_name: string | null;
}

interface DatabaseEmailPreference {
    user_id: string;
    frequency: string;
    format: string;
    enabled: boolean;
    user: UserData[];
}

interface QueueResult {
    email: string;
    userId: string;
    status: 'queued' | 'failed' | 'skipped';
    queueId?: string;
    error?: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    try {
        // Only allow POST
        if (req.method !== 'POST') {
            return errorResponse('Method not allowed', undefined, 405);
        }

        // Get current reporting week dates
        const { start, end } = getCurrentReportingWeek();
        const { year, week } = getYearWeek(end);
        const yearWeekCode = `${year}-${week.toString().padStart(2, '0')}`;

        log.info('Processing weekly report notifications', {
            yearWeek: yearWeekCode,
            dateRange: `${start.toISOString()} to ${end.toISOString()}`
        });

        // Get all users with weekly report preferences
        const { data: preferences, error: prefError } = await supabaseAdmin
            .from('user_email_preferences')
            .select(`
                user_id,
                frequency,
                format,
                enabled,
                user:user_id (
                    email,
                    first_name,
                    last_name
                )
            `)
            .eq('category_id', 'weekly-report')
            .eq('enabled', true)
            .neq('frequency', 'never');

        if (prefError) {
            throw new Error(`Failed to fetch user preferences: ${prefError.message}`);
        }

        if (!preferences || preferences.length === 0) {
            log.info('No recipients found for weekly report notifications');
            return successResponse({
                message: 'No recipients found',
                yearWeek: yearWeekCode
            });
        }

        // Get report URL from environment
        const publicUrl = Deno.env.get('PUBLIC_URL');
        const clientReportUrl = Deno.env.get('CLIENT_REPORT_URL');

        if (!publicUrl) {
            throw new Error('PUBLIC_URL environment variable is missing');
        }

        // Queue emails for each recipient
        const results: QueueResult[] = await Promise.all(
            (preferences as DatabaseEmailPreference[]).map(async (pref) => {
                try {
                    const userData = pref.user[0];
                    // Skip if user data is missing
                    if (!userData?.email) {
                        return {
                            userId: pref.user_id,
                            email: '',
                            status: 'skipped',
                            error: 'User email not found'
                        };
                    }

                    // Determine report URL based on email domain
                    const domain = userData.email.split('@')[1]?.toLowerCase();
                    const clientDomains = Deno.env.get('CLIENT_DOMAINS')?.split(',')
                        .map(d => d.trim().toLowerCase())
                        .filter(Boolean) || [];
                    
                    const useClientUrl = domain && clientDomains.includes(domain);
                    const reportUrl = useClientUrl && clientReportUrl
                        ? `${clientReportUrl}/${yearWeekCode}`
                        : `${publicUrl}/weekly-report/${yearWeekCode}`;

                    // Queue email
                    const { data: queuedEmail, error: queueError } = await supabaseAdmin
                        .from('email_queue')
                        .insert({
                            template_id: 'weekly-report',
                            recipient_email: userData.email,
                            recipient_user_id: pref.user_id,
                            category_id: 'weekly-report',
                            subject: `Weekly Maritime Security Report - Week ${week}, ${year}`,
                            variables: {
                                recipient_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
                                weekNumber: week,
                                year,
                                yearWeek: yearWeekCode,
                                dateRange: `${start.toLocaleDateString('en-GB', { 
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })} - ${end.toLocaleDateString('en-GB', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })}`,
                                reportUrl
                            },
                            priority: 'normal',
                            metadata: {
                                year_week: yearWeekCode,
                                report_url: reportUrl
                            },
                            rate_limit_key: `weekly_report_${yearWeekCode}`,
                            rate_limit_window: 'PT1H',  // 1 hour
                            rate_limit_count: 100       // Max 100 per hour
                        })
                        .select()
                        .single();

                    if (queueError) {
                        throw new Error(`Failed to queue email: ${queueError.message}`);
                    }

                    log.info('Weekly report notification queued', {
                        recipient: userData.email,
                        queueId: queuedEmail.id
                    });

                    return {
                        email: userData.email,
                        userId: pref.user_id,
                        status: 'queued',
                        queueId: queuedEmail.id
                    };

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    log.error('Error queueing weekly report email', {
                        error: errorMessage,
                        userId: pref.user_id
                    });

                    return {
                        email: pref.user[0]?.email || '',
                        userId: pref.user_id,
                        status: 'failed',
                        error: errorMessage
                    };
                }
            })
        );

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
            message: 'Weekly report notifications queued',
            yearWeek: yearWeekCode,
            queued: results.filter(r => r.status === 'queued').length,
            failed: results.filter(r => r.status === 'failed').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            results
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return errorResponse('Failed to process weekly report notifications', errorMessage);
    }
});
