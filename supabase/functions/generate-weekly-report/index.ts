import { serve } from 'http/server';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/http.ts';
import { callClaudeWithPrompt } from '../_shared/llmService.ts';

interface RegionalStats {
    incidents: number;
    threatLevel: {
        level: 'Low' | 'Moderate' | 'Substantial';
        icon: string;
    };
}

interface RegionalData {
    [region: string]: RegionalStats;
}

/**
 * Gets regional stats from incidents
 */
function getRegionalStats(incidents: any[]): RegionalData {
    const regions = ["West Africa", "Southeast Asia", "Indian Ocean", "Americas", "Europe"];
    const regionalData: RegionalData = {};
    
    // Initialize regions
    regions.forEach(region => {
        regionalData[region] = {
            incidents: 0,
            threatLevel: { level: "Low", icon: "●" }
        };
    });
    
    // Count incidents by region
    incidents.forEach(inc => {
        const region = inc.region;
        if (region && regionalData[region]) {
            regionalData[region].incidents++;
        }
    });
    
    // Calculate threat levels
    Object.entries(regionalData).forEach(([region, data]) => {
        if (region === "Southeast Asia" || region === "Indian Ocean" || region === "West Africa") {
            data.threatLevel = { level: 'Substantial', icon: '▲' };
        } else if (data.incidents >= 2) {
            data.threatLevel = { level: 'Moderate', icon: '►' };
        }
    });
    
    return regionalData;
}

/**
 * Fetches historical trends data
 */
async function fetchHistoricalTrends() {
    try {
        const { data: trends, error } = await supabaseAdmin
            .from('incident_trends')
            .select('*')
            .order('date', { ascending: false })
            .limit(12);  // Last 12 months

        if (error) {
            throw error;
        }

        return trends || [];
    } catch (error) {
        log.warn("Error fetching historical trends", error);
        return [];
    }
}

/**
 * Gets cached report content or generates new content
 */
async function getReportContent(startDate: Date, endDate: Date, forceRefresh = false) {
    const cacheKey = `${startDate.toISOString()}_${endDate.toISOString()}`;

    // Try to get cached content first (if not forcing refresh)
    if (!forceRefresh) {
        const { data: cachedData } = await supabaseAdmin.rpc(
            'get_cached_data',
            {
                p_cache_type: 'weekly_report',
                p_cache_key: cacheKey
            }
        );

        if (cachedData) {
            log.info(`Using cached weekly report content for ${startDate} to ${endDate}`);
            return {
                content: cachedData,
                cached: true
            };
        }
    }

    log.info(`Generating new weekly report content for ${startDate} to ${endDate}`);

    // Fetch incidents for the week
    const { data: incidents, error: incidentsError } = await supabaseAdmin
        .from('incidents')
        .select('*')
        .gte('occurred_at', startDate.toISOString())
        .lt('occurred_at', endDate.toISOString())
        .order('occurred_at', { ascending: true });

    if (incidentsError) {
        throw new Error(`Failed to fetch incidents: ${incidentsError.message}`);
    }

    // Get historical trend data
    const trends = await fetchHistoricalTrends();

    // Generate regional stats
    const regionalStats = getRegionalStats(incidents || []);

    // Prepare data for the LLM
    const reportData = {
        incidents: incidents || [],
        regionalData: {
            stats: regionalStats,
            trends
        },
        startDate,
        endDate
    };

    // Generate report content using LLM
    const reportContent = await callClaudeWithPrompt('weeklyReport', reportData);

    // Cache the generated content
    await supabaseAdmin.rpc(
        'store_cached_data',
        {
            p_cache_type: 'weekly_report',
            p_cache_key: cacheKey,
            p_data: reportContent,
            p_parameters: {
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                incident_count: incidents?.length || 0
            },
            p_ttl: 'P7D',  // 7 days TTL
            p_metadata: {
                generated_at: new Date().toISOString(),
                source: forceRefresh ? 'manual-refresh' : 'on-demand'
            }
        }
    );

    return {
        content: reportContent,
        cached: false
    };
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    try {
        const url = new URL(req.url);
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');
        const refresh = url.searchParams.get('refresh') === 'true';

        if (!start || !end) {
            return errorResponse(
                'Missing parameters',
                'start and end dates are required',
                400
            );
        }

        // Parse dates
        const startDate = new Date(start);
        const endDate = new Date(end);

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return errorResponse(
                'Invalid dates',
                'start and end must be valid dates',
                400
            );
        }

        // Get report content
        const { content, cached } = await getReportContent(startDate, endDate, refresh);

        // Return the content
        return new Response(
            JSON.stringify({
                content,
                metadata: {
                    period: {
                        start: startDate.toISOString(),
                        end: endDate.toISOString()
                    },
                    cache: {
                        status: cached ? 'HIT' : 'MISS',
                        source: cached ? 'postgres-cache' : 'generated'
                    }
                }
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': cached ? 'public, max-age=86400' : 'no-cache',
                    'X-Cache': cached ? 'HIT' : 'MISS'
                }
            }
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Error generating weekly report content:', error);
        return errorResponse(
            'Failed to generate weekly report content',
            errorMessage
        );
    }
});
