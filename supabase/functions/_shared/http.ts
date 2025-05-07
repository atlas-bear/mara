/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';

/**
 * Standard CORS headers for Edge Functions
 */
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Standard response structure
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        details?: unknown;
    };
}

/**
 * Create a successful JSON response with CORS headers
 */
export function successResponse<T>(data: T, status = 200): Response {
    return new Response(
        JSON.stringify({
            success: true,
            data
        } as ApiResponse<T>),
        {
            status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        }
    );
}

/**
 * Create an error JSON response with CORS headers
 */
export function errorResponse(message: string, details?: unknown, status = 500): Response {
    // Log the error
    log.error(message, { details });

    return new Response(
        JSON.stringify({
            success: false,
            error: {
                message,
                details
            }
        } as ApiResponse<never>),
        {
            status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        }
    );
}

/**
 * Handle CORS preflight requests
 */
export function handleCors(): Response {
    return new Response('ok', { headers: corsHeaders });
}

/**
 * Parse and validate request body
 * @throws Error if parsing fails or validation fails
 */
export async function parseRequestBody<T>(request: Request, validate?: (body: T) => boolean | string): Promise<T> {
    try {
        const body = await request.json() as T;
        
        if (validate) {
            const validationResult = validate(body);
            if (validationResult !== true) {
                const message = typeof validationResult === 'string' 
                    ? validationResult 
                    : 'Invalid request body';
                throw new Error(message);
            }
        }

        return body;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to parse request body';
        throw new Error(message);
    }
}
