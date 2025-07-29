/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';

interface Branding {
    logo: string;
    companyName: string;
    colors: {
        primary: string;
        secondary: string;
    };
}

interface IncidentLocation {
    name: string;
    latitude: number;
    longitude: number;
}

interface Vessel {
    name: string;
    type: string;
    flag: string;
    imo: string;
    crew_impact?: string;
}

interface Incident {
    id: string;
    title: string;
    description: string;
    date_time_utc: string;
    location: IncidentLocation;
    vessels_involved: Vessel[];
    status: string;
    incident_type: string[];
    analysis?: string;
    recommendations?: string;
    map_image_url?: string;
}

interface EmailTemplateData {
    incident: Incident;
    branding: Branding;
    publicUrl: string;
}

/**
 * Get default MARA branding for emails
 */
export function getDefaultBranding(): Branding {
    log.info('Using default MARA branding for email');

    return {
        logo: Deno.env.get('DEFAULT_LOGO') || 'https://res.cloudinary.com/dwnh4b5sx/image/upload/v1741248008/branding/public/mara_logo_k4epmo.png',
        companyName: Deno.env.get('DEFAULT_COMPANY_NAME') || 'MARA Maritime Risk Analysis',
        colors: {
            primary: Deno.env.get('DEFAULT_PRIMARY_COLOR') || '#234567',
            secondary: Deno.env.get('DEFAULT_SECONDARY_COLOR') || '#890123',
        },
    };
}

/**
 * Format coordinates in degrees, minutes, seconds format
 */
function formatCoordinates(coordinate: number, type: 'lat' | 'lon'): string {
    if (coordinate === null || coordinate === undefined || isNaN(coordinate)) {
        return 'N/A';
    }

    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(2);

    const direction = type === 'lat'
        ? (coordinate >= 0 ? 'N' : 'S')
        : (coordinate >= 0 ? 'E' : 'W');

    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Render email template with provided data
 */
export function renderEmailTemplate(data: EmailTemplateData): string {
    const { incident, branding, publicUrl } = data;
    const vessel = incident.vessels_involved[0] || { name: 'Unknown Vessel', type: 'Unknown', flag: 'Unknown', imo: 'N/A' };
    const incidentType = incident.incident_type[0] || 'Incident';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Maritime Flash Alert</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #FFF7ED; padding: 24px; border-bottom: 1px solid #FFEDD5;">
            <img src="${branding.logo}" alt="${branding.companyName}" style="max-width: 150px; height: auto; margin-bottom: 15px;">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div>
                        <span style="display: inline-block; padding: 4px 10px; background-color: #FEE2E2; border-radius: 9999px; color: #991B1B; font-size: 14px; font-weight: bold;">Alert ID: ${incident.id}</span>
                        <span style="display: inline-block; padding: 4px 10px; background-color: #FEF3C7; border-radius: 9999px; color: #92400E; font-size: 14px; font-weight: bold;">${incidentType}</span>
                    </div>
                    <h1 style="font-size: 24px; font-weight: bold; margin-top: 8px; margin-bottom: 4px; color: ${branding.colors.primary};">
                        ${vessel.name}
                    </h1>
                    <p style="font-size: 14px; color: #4B5563; margin: 0; font-weight: 600;">
                        <span style="display: inline-block; margin-right: 10px; color: #111827;">Type: <strong>${vessel.type}</strong></span> | 
                        <span style="display: inline-block; margin: 0 10px; color: #111827;">IMO: <strong>${vessel.imo}</strong></span> | 
                        <span style="display: inline-block; margin-left: 10px; color: #111827;">Flag: <strong>${vessel.flag}</strong></span>
                    </p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 14px; color: #6B7280; margin: 0 0 4px 0;">Reported</p>
                    <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">
                        ${new Date(incident.date_time_utc).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>

        ${publicUrl ? `
        <!-- View Online Banner -->
        <div style="background-color: #EFF6FF; padding: 16px; text-align: center; border-bottom: 1px solid #DBEAFE;">
            <p style="margin: 0; font-size: 14px; color: #1E3A8A;">
                This is an email snapshot. 
                <a href="${publicUrl}" style="color: #2563EB; font-weight: 600; text-decoration: underline;">
                    View this Flash Report online
                </a> 
                for the latest information.
            </p>
        </div>
        ` : ''}

        <!-- Location Map -->
        <div style="padding: 24px; border-bottom: 1px solid #E5E7EB;">
            <h2 style="font-size: 18px; font-weight: 600; color: ${branding.colors.primary}; margin-top: 0; margin-bottom: 16px;">Location</h2>
            
            ${incident.map_image_url 
                ? `<img src="${incident.map_image_url}" alt="Incident Location Map" style="display: block; width: 100%; max-width: 600px; height: auto; border-radius: 4px; border: 1px solid #E5E7EB;" 
                    onerror="this.onerror=null; this.src='https://res.cloudinary.com/dwnh4b5sx/image/upload/maps/public/error-map.jpg';">`
                : '<div style="width: 100%; height: 300px; background-color: #f3f4f6; border-radius: 4px; display: flex; justify-content: center; align-items: center; text-align: center; color: #6B7280;">Map image not available</div>'
            }
            
            <!-- Location details -->
            <p style="font-size: 16px; margin-top: 8px; text-align: center; font-weight: 600; color: #1F2937;">
                ${incident.location.name}<br>
                <span style="font-size: 14px; color: #6B7280;">
                    ${formatCoordinates(incident.location.latitude, 'lat')}, ${formatCoordinates(incident.location.longitude, 'lon')}
                </span>
            </p>
        </div>

        <!-- Incident Details -->
        <div style="padding: 24px; border-bottom: 1px solid #E5E7EB;">
            <h2 style="font-size: 18px; font-weight: 600; color: ${branding.colors.primary}; margin-top: 0; margin-bottom: 16px;">Incident Details</h2>
            
            <!-- Description -->
            <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Description</h3>
                <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${incident.description}</p>
            </div>

            ${incident.analysis ? `
            <!-- Analysis -->
            <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Analysis</h3>
                <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${incident.analysis}</p>
            </div>
            ` : ''}

            ${incident.recommendations ? `
            <!-- Recommendations -->
            <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px;">
                <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Recommendations</h3>
                <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${incident.recommendations}</p>
            </div>
            ` : ''}
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; padding: 0 24px 24px; text-align: center; color: #6B7280; font-size: 12px;">
            <p style="margin: 4px 0;">© ${new Date().getFullYear()} ${branding.companyName}. All rights reserved.</p>
            <p style="margin: 4px 0;">This alert is confidential and for the intended recipient only.</p>
        </div>
    </body>
    </html>
    `;
}
