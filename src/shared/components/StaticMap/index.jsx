import React, { useEffect, useState } from 'react';

/**
 * A lightweight static map component that uses Mapbox Static Images API
 * instead of WebGL-based maps to avoid browser WebGL context limits
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array<Object>} [props.incidents=[]] - Array of incident objects to display
 * @param {Array<number>} [props.center=[0, 0]] - Center coordinates [longitude, latitude]
 * @param {number} [props.zoom=5] - Zoom level
 * @param {string} [props.className="w-full h-[300px] rounded-lg"] - CSS class for container
 * @param {Object} [props.style] - Additional inline styles
 */
const StaticMap = ({
  incidents = [],
  center = [0, 0],
  zoom = 5,
  className = "w-full h-[300px] rounded-lg",
  style = { border: '1px solid #e5e7eb' }
}) => {
  const [mapUrl, setMapUrl] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [error, setError] = useState(false);
  
  useEffect(() => {
    // Get Mapbox token from environment
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    
    if (!token) {
      setError(true);
      return;
    }
    
    try {
      // Process incidents to create markers with custom styling
      const markers = incidents.map(incident => {
        // Get color based on incident type
        const color = getMarkerColorByType(incident.type);
        
        // Create marker string - use circle markers instead of pins
        // Use size-l for larger circles (similar to pulsing dots)
        return `circle-xl+${color.replace('#', '')}(${incident.longitude},${incident.latitude})`;
      }).join(',');
      
      // Use the same custom map style as the interactive map
      const mapStyle = 'mapbox/light-v11'; // Use standard mapbox style for more reliability
      
      // Generate the static map URL
      const url = `https://api.mapbox.com/styles/v1/${mapStyle}/static/${
        markers || `circle-xl+EF4444(${center[0]},${center[1]})`
      }/${center[0]},${center[1]},${zoom},0/600x300@2x?access_token=${token}`;
      
      setMapUrl(url);
      
      // Create fallback URL with default mapbox style
      setFallbackUrl(`https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/circle-xl+EF4444(${center[0]},${center[1]})/${center[0]},${center[1]},${zoom},0/600x300@2x?access_token=${token}`);
    } catch (err) {
      console.error('Error generating static map URL:', err);
      setError(true);
    }
  }, [incidents, center, zoom]);
  
  if (error || !mapUrl) {
    return (
      <div className={className} style={style}>
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <p className="text-gray-500 text-sm">Map could not be loaded</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={className} style={style}>
      <img
        src={mapUrl}
        alt="Map showing incident location"
        className="w-full h-full object-cover rounded-lg"
        loading="lazy"
        onError={(e) => {
          console.warn('Error loading static map, trying fallback');
          e.target.src = fallbackUrl;
        }}
      />
    </div>
  );
};

/**
 * Get an appropriate marker color based on incident type
 */
function getMarkerColorByType(type) {
  if (!type) return '6B7280'; // Default gray (remove # for Mapbox API)
  
  const lowerType = String(type).toLowerCase();
  
  // Normalize type using the same logic as in MaritimeMap
  const normalizedType = normalizeIncidentType(lowerType);
  
  // Return color based on normalized type - match MaritimeMap colors
  const typeColors = {
    'violent': 'EF4444',     // Red - rgb(239,68,68)
    'robbery': '22C55E',     // Green - rgb(34,197,94)
    'military': '8B5CF6',    // Purple - rgb(139,92,246)
    'suspicious': 'F97316',  // Orange - rgb(249,115,22)
    'cyber': '06B6D4',       // Cyan - rgb(6,182,212)
    'smuggling': 'A855F7',   // Purple-pink - rgb(168,85,247)
    'default': '6B7280'      // Gray - rgb(107,114,128)
  };
  
  return typeColors[normalizedType] || typeColors.default;
}

// Helper function to normalize incident types - this matches the logic in MaritimeMap
function normalizeIncidentType(lowerType) {
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
  
  // Default for uncategorized
  return 'default';
}

export default StaticMap;