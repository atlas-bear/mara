import React from 'react';
import './MapStyles.css';

/**
 * Static map component that uses Mapbox Static Maps API instead of WebGL
 * Provides a lightweight alternative for overview maps with many incidents
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array<Object>} [props.incidents=[]] - Array of incident objects to display on the map
 * @param {Array<number>} [props.center=[103.8, 1.12]] - Map center coordinates [longitude, latitude]
 * @param {number} [props.zoom=1] - Zoom level
 * @param {number} [props.width=800] - Image width
 * @param {number} [props.height=300] - Image height
 * @returns {JSX.Element} Rendered static map component
 */
const StaticMaritimeMap = ({ 
  incidents = [], 
  center = [103.8, 1.12],
  zoom = 1,
  width = 800,
  height = 300
}) => {
  // Get MapBox token - safely access environment variables
  const token = import.meta?.env?.VITE_MAPBOX_TOKEN || '';
  
  // Reference color scheme from the interactive map
  const typeColors = {
    'violent': 'ff4444',    // Red - Attack, Boarding, Piracy, Kidnapping, etc.
    'robbery': '22c55e',    // Green - Robbery, Theft
    'military': '8b5cf6',   // Purple - Military, Navy, Firing Exercise
    'suspicious': 'f97316', // Orange - Suspicious, Advisory, Irregular, Sighting
    'cyber': '06b6d4',      // Cyan - Cyber incidents
    'smuggling': 'a855f7',  // Purple-pink - Smuggling
    'default': '6b7280'     // Gray - Fallback for uncategorized
  };
  
  /**
   * Normalizes incident types into predefined categories for consistent display
   * Same logic as in the interactive map for consistency
   */
  const normalizeIncidentType = (type) => {
    if (!type) return 'default';
    
    // Convert to lowercase for case-insensitive matching
    const lowerType = type.toLowerCase().trim();
    
    // VIOLENT INCIDENTS - Red
    if (/attack|arm|weapon|assault|fire|shoot|boarding|board|piracy|hijack|kidnap|explosion|explosi/.test(lowerType)) {
      return 'violent';
    }
    
    // ROBBERY/THEFT INCIDENTS - Green
    if (/robbery|theft|steal|stolen/.test(lowerType)) {
      return 'robbery';
    }
    
    // MILITARY/NAVAL INCIDENTS - Purple
    if (/military|navy|coast guard|firing exercise|exercise|drill/.test(lowerType)) {
      return 'military';
    }
    
    // SUSPICIOUS/ADVISORY INCIDENTS - Orange
    if (/suspicious|approach|attempt|advisory|alert|irregular|general alert|sighting|sight/.test(lowerType)) {
      return 'suspicious';
    }
    
    // OTHER CATEGORIZED INCIDENTS
    if (/cyber/.test(lowerType)) return 'cyber';
    if (/smuggl/.test(lowerType)) return 'smuggling';
    
    // Handle "unknown" type more gracefully
    if (lowerType === 'unknown' || lowerType === 'unknown type') {
      return 'suspicious';
    }
    
    // If we can't categorize, use a default
    return 'default';
  };
  
  // Limited markers to avoid URL length limits (max ~100 markers for static API)
  const MAX_MARKERS = 99;
  
  // Create marker strings for static map API
  // Use clustering if too many incidents
  let markers = '';
  if (incidents.length <= MAX_MARKERS) {
    // Direct markers for each incident
    markers = incidents.map(incident => {
      const normalizedType = normalizeIncidentType(incident.type);
      const color = typeColors[normalizedType];
      return `pin-s+${color}(${incident.longitude},${incident.latitude})`;
    }).join(',');
  } else {
    // Use a few representative markers with label counts
    // Group incidents by region
    const regions = {};
    incidents.forEach(incident => {
      const lat = Math.round(incident.latitude * 10) / 10;
      const lng = Math.round(incident.longitude * 10) / 10;
      const key = `${lat},${lng}`;
      if (!regions[key]) {
        regions[key] = {
          lat: incident.latitude,
          lng: incident.longitude,
          count: 0,
          types: {}
        };
      }
      regions[key].count++;
      
      const normalizedType = normalizeIncidentType(incident.type);
      regions[key].types[normalizedType] = (regions[key].types[normalizedType] || 0) + 1;
    });
    
    // Convert to markers with count labels (max 25 regions to avoid URL issues)
    markers = Object.values(regions)
      .sort((a, b) => b.count - a.count)
      .slice(0, 25)
      .map(region => {
        // Find dominant type
        let dominantType = 'default';
        let maxCount = 0;
        Object.entries(region.types).forEach(([type, count]) => {
          if (count > maxCount) {
            maxCount = count;
            dominantType = type;
          }
        });
        
        const color = typeColors[dominantType];
        return `pin-l-${region.count > 9 ? 'a' : region.count}+${color}(${region.lng},${region.lat})`;
      }).join(',');
  }
  
  // Create static map URL
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${markers}/${center.join(',')},${zoom},0/${width}x${height}@2x?access_token=${token}`;
  
  if (!token) {
    return (
      <div className="w-full h-[300px] rounded-lg bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Unable to load map. API token not found.</p>
      </div>
    );
  }
  
  return (
    <div className="relative w-full">
      <div className="w-full h-[300px] rounded-lg overflow-hidden border border-gray-200">
        <img 
          src={mapUrl} 
          alt="Map displaying maritime incidents" 
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Optional overlay for incident count */}
        {incidents.length > MAX_MARKERS && (
          <div className="absolute bottom-2 left-2 bg-white bg-opacity-75 rounded px-2 py-1 text-xs text-gray-600">
            Showing {incidents.length} incidents (clustered view)
          </div>
        )}
      </div>
    </div>
  );
};

export default StaticMaritimeMap;