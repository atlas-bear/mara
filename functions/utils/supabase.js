// supabase.js - Utility for Supabase integration
import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase connection
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

// Initialize Supabase client
let supabaseClient = null;

/**
 * Get the Supabase client, creating it if it doesn't exist
 * @returns {Object} Supabase client instance
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Supabase configuration missing. SUPABASE_URL and SUPABASE_KEY are required.');
    }
    
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  
  return supabaseClient;
}

/**
 * Fetch all flash report recipients from the Supabase users table
 * @param {Object} options - Optional filtering parameters
 * @param {Array<string>} options.regions - Filter by regions of interest (future use)
 * @param {Array<string>} options.incidentTypes - Filter by incident types of interest (future use)
 * @returns {Promise<Array>} Array of recipient objects with email and metadata
 */
export async function getFlashReportRecipients(options = {}) {
  const supabase = getSupabaseClient();
  
  try {
    console.log('Fetching flash report recipients from Supabase');
    
    // Start building the query - select only necessary columns and filter by the dedicated boolean column
    let query = supabase
      .from('users')
      .select('id, email, first_name, last_name, preferences, receive_flash_reports')
      .eq('receive_flash_reports', true); // Use the dedicated boolean column
    
    // For future use - region and incident type filtering can use preferences column
    // Currently we're using post-query filtering, but this can be enhanced with 
    // PostgreSQL jsonb operators when these preferences are actively used
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching recipients from Supabase:', error);
      throw error;
    }
    
    // Apply additional filtering based on preferences for future use
    // For now, these filters will likely not do anything since preferences may not have these fields
    let recipients = data;
    
    // For future use - filter by region if that data is available in preferences
    if (options.regions && options.regions.length > 0) {
      recipients = recipients.filter(user => {
        // Skip filtering if no preferences or regions
        if (!user.preferences || !user.preferences.regions) return true;
        
        // Check if user has regions preference and if there's any overlap
        const userRegions = user.preferences.regions || [];
        return userRegions.length === 0 || userRegions.some(region => options.regions.includes(region));
      });
    }
    
    // For future use - filter by incident type if that data is available in preferences
    if (options.incidentTypes && options.incidentTypes.length > 0) {
      recipients = recipients.filter(user => {
        // Skip filtering if no preferences or incident_types
        if (!user.preferences || !user.preferences.incident_types) return true;
        
        // Check if user has incident_types preference and if there's any overlap
        const userTypes = user.preferences.incident_types || [];
        return userTypes.length === 0 || userTypes.some(type => options.incidentTypes.includes(type));
      });
    }
    
    console.log(`Found ${recipients.length} recipients for flash report`);
    
    // Format recipients in the structure expected by send-flash-report
    return recipients.map(user => ({
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      metadata: {
        userId: user.id,
        preferences: user.preferences || {}
      }
    }));
    
  } catch (error) {
    console.error('Error in getFlashReportRecipients:', error);
    throw error;
  }
}

/**
 * Check if an email should use client branding based on domain
 * @param {string} email - Email address to check
 * @returns {boolean} True if client branding should be used
 */
export function shouldUseClientBranding(email) {
  if (!email) return false;
  
  try {
    // Extract domain from email
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    
    // Get client domains from environment variable - no defaults in code
    const clientDomains = (process.env.CLIENT_DOMAINS || '')
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);
    
    // Check if the email domain is in the list of client domains
    const isClientDomain = clientDomains.includes(domain);
    
    // Log without exposing specific domains
    console.log(`Email domain branding check: ${isClientDomain ? 'Using client branding' : 'Using default branding'}`);
    
    return isClientDomain;
    
  } catch (error) {
    console.error('Error in shouldUseClientBranding:', error);
    return false;
  }
}