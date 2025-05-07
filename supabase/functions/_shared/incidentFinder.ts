/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { supabaseAdmin } from './supabaseClient.ts';
import { log } from './logger.ts';
import {
  calculateTimeProximityScore,
  calculateSpatialProximityScore,
  isValidCoordinate,
  // calculateDistance // Import if needed for raw distance logging
} from './spatialUtils.ts';
import {
  calculateVesselNameSimilarity,
  // calculateIncidentTypeSimilarity, // Can be added later if needed
} from './similarityUtils.ts';

// Define basic types matching expected Supabase table structures
// deno-lint-ignore no-explicit-any
type RawDataRecord = Record<string, any> & { id: string };
// deno-lint-ignore no-explicit-any
type IncidentRecord = Record<string, any> & { id: string };

const SIMILARITY_THRESHOLD = 0.75; // Minimum weighted score to consider an incident similar
const TIME_WINDOW_HOURS = 48; // Look for incidents +/- 48 hours
const SPATIAL_WINDOW_KM = 50; // Look for incidents within 50 km

/**
 * Finds potentially similar existing incidents in the cser.incident table.
 * Filters candidates by time and location in the DB query, then scores them based on multiple factors.
 *
 * @param recordToProcess The raw_data record being processed.
 * @returns The most similar existing IncidentRecord above the threshold, or null.
 */
export async function findSimilarExistingIncident(recordToProcess: RawDataRecord): Promise<IncidentRecord | null> {
    // Extract necessary fields from the raw record
    const { date, latitude, longitude, vessel_name, incident_type_name, description: rawDesc, location: rawLocation } = recordToProcess;

    // Validate essential input fields
    if (!date || latitude === null || longitude === null || !isValidCoordinate(latitude, longitude)) {
        log.warn('Cannot search for similar incidents: Missing or invalid date/coordinates in raw record.', {
             id: recordToProcess.id, date, latitude, longitude
            });
        return null;
    }

    let incidentDate: Date;
    try {
        incidentDate = new Date(date);
        if (isNaN(incidentDate.getTime())) throw new Error('Invalid date format');
    } catch (e) {
        log.warn('Invalid date in raw record, cannot search for similar incidents.', { id: recordToProcess.id, date });
        return null;
    }

    try {
        // --- Database Query for Candidates ---
        const startDate = new Date(incidentDate.getTime() - TIME_WINDOW_HOURS * 60 * 60 * 1000);
        const endDate = new Date(incidentDate.getTime() + TIME_WINDOW_HOURS * 60 * 60 * 1000);

        // Define spatial window (simple bounding box)
        // TODO: Consider using PostGIS ST_DWithin for more accurate spatial filtering if available/performant
        const degreesPerKmLat = 1 / 111.32; // More precise approximation
        const degreesPerKmLon = 1 / (111.32 * Math.cos(latitude * Math.PI / 180));
        const latDelta = SPATIAL_WINDOW_KM * degreesPerKmLat;
        const lonDelta = SPATIAL_WINDOW_KM * degreesPerKmLon;
        const minLat = latitude - latDelta;
        const maxLat = latitude + latDelta;
        const minLon = longitude - lonDelta;
        const maxLon = longitude + lonDelta;

        log.info('Querying for similar incident candidates', {
            recordId: recordToProcess.id,
            timeWindow: { start: startDate.toISOString(), end: endDate.toISOString() },
            spatialBox: { minLat: minLat.toFixed(4), maxLat: maxLat.toFixed(4), minLon: minLon.toFixed(4), maxLon: maxLon.toFixed(4) }
        });

        // Query potential candidates from the incident table
        const { data: candidates, error: queryError } = await supabaseAdmin
            .from('incident')
            .select('*') // Fetch all fields needed for scoring and rules
            .schema('cser')
            .gte('date_time_utc', startDate.toISOString())
            .lte('date_time_utc', endDate.toISOString())
            .gte('latitude', minLat)
            .lte('latitude', maxLat)
            .gte('longitude', minLon)
            .lte('longitude', maxLon);
            // Note: This might fetch more candidates than needed if the area is dense.
            // PostGIS would be more efficient here.

        if (queryError) {
            log.error('Error querying for similar incident candidates', { error: queryError });
            return null; // Don't block processing due to similarity check error
        }

        if (!candidates || candidates.length === 0) {
            log.info('No similar incident candidates found within time/spatial window.');
            return null;
        }

        log.info(`Found ${candidates.length} candidates within time/spatial window. Scoring...`);

        // --- Scoring Candidates ---
        let bestMatch: IncidentRecord | null = null;
        let highestScore = -1;

        for (const candidate of candidates as IncidentRecord[]) {
            // Ensure candidate has necessary fields for scoring
            if (!candidate.date_time_utc || candidate.latitude === null || candidate.longitude === null || !isValidCoordinate(candidate.latitude, candidate.longitude)) {
                log.warn('Skipping candidate due to missing date/coordinates', { candidateId: candidate.id });
                continue;
            }

            const timeScore = calculateTimeProximityScore(date, candidate.date_time_utc, TIME_WINDOW_HOURS);
            const spatialScore = calculateSpatialProximityScore(latitude, longitude, candidate.latitude, candidate.longitude, SPATIAL_WINDOW_KM);
            const vesselScore = calculateVesselNameSimilarity(vessel_name, candidate.title); // Using title as proxy

            // Placeholder for type similarity - requires fetching linked type name for candidate
            // For now, compare raw incident_type_name with candidate's (assuming it's stored directly or fetched)
            const typeScore = (incident_type_name && candidate.incident_type_name && incident_type_name.toLowerCase() === candidate.incident_type_name.toLowerCase()) ? 1.0 : 0.5; // Simple match or neutral

            // --- Apply Rule-Based Checks (adapted from original logic) ---
            let isSameIncident = false;
            const candidateDesc = candidate.description?.toLowerCase() || '';
            const rawDescriptionLower = rawDesc?.toLowerCase() || '';

            // Rule 1: Very close time/space + vessel match
            if (timeScore > 0.75 && spatialScore > 0.9 && vesselScore >= 0.7) isSameIncident = true;
            // Rule 2: Strong vessel match + good time/space
            if (vesselScore > 0.8 && timeScore > 0.5 && spatialScore > 0.7) isSameIncident = true;
            // Rule 3: Near-perfect time/space match
            if (timeScore > 0.95 && spatialScore > 0.95) isSameIncident = true;
            // Rule 4: Type match (using simple check) + good time/space
            if (typeScore === 1.0 && timeScore > 0.6 && spatialScore > 0.7) isSameIncident = true;
            // Rule 5: Very strong spatial match + good time
            if (spatialScore > 0.95 && timeScore > 0.6) isSameIncident = true;
            // Rule 6: Location name match (simple check) + good time/space
            const loc1 = rawLocation?.toLowerCase().trim();
            const loc2 = candidate.location_name?.toLowerCase().trim();
            if (loc1 && loc2 && (loc1.includes(loc2) || loc2.includes(loc1)) && timeScore > 0.7 && spatialScore > 0.6) isSameIncident = true;
            // Rule 7: Matching stolen items (simple keyword check) + reasonable time/space
            const stolenItemPatterns = [/air\s*compressor/i, /breathing\s*apparatus/i, /padlocks?/i, /engine\s*spares/i];
            let stolenItemsMatch = false;
            for (const pattern of stolenItemPatterns) {
                if (pattern.test(rawDescriptionLower) && pattern.test(candidateDesc)) {
                    stolenItemsMatch = true;
                    break;
                }
            }
            if (stolenItemsMatch && timeScore > 0.5 && spatialScore > 0.5) isSameIncident = true;

            // Safeguard: Different incidents on same vessel?
            if (vesselScore > 0.8 && timeScore < 0.2 && spatialScore < 0.3) {
                isSameIncident = false; // Override if time/space are very different despite vessel match
                log.info('Potential different incidents on same vessel detected, overriding match.', { recordId: recordToProcess.id, candidateId: candidate.id });
            }

            // Calculate weighted total score
            const totalScore = (timeScore * 0.4) + (spatialScore * 0.4) + (vesselScore * 0.15) + (typeScore * 0.05);

             log.info('Calculated similarity score for candidate', {
                 candidateId: candidate.id, timeScore: timeScore.toFixed(3), spatialScore: spatialScore.toFixed(3),
                 vesselScore: vesselScore.toFixed(3), typeScore: typeScore.toFixed(3), totalScore: totalScore.toFixed(3),
                 isSameHeuristic: isSameIncident
             });

            // Update best match if this candidate is better and meets criteria
            // Either the heuristic rules determined it's the same, OR the score is above threshold
            if ((isSameIncident || totalScore >= SIMILARITY_THRESHOLD) && totalScore > highestScore) {
                highestScore = totalScore;
                bestMatch = candidate;
            }
        }

        if (bestMatch) {
            log.info(`Found best similar incident match`, { incidentId: bestMatch.id, score: highestScore.toFixed(4) });
            return bestMatch;
        } else {
            log.info(`No candidates met the similarity threshold (${SIMILARITY_THRESHOLD}) or rules.`);
            return null;
        }

    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error('Error in findSimilarExistingIncident', { error: error.message, stack: error.stack });
        return null; // Return null on error to allow processing to continue
    }
}
