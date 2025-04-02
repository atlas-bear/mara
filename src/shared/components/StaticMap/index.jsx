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
  const [useFallback, setUseFallback] = useState(false);
  
  useEffect(() => {
    // Get environment variables
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    
    if (!mapboxToken) {
      console.error('Error: Missing Mapbox API token');
      setError(true);
      return;
    }
    
    if (!cloudName) {
      console.warn('Warning: Missing Cloudinary cloud name, falling back to Mapbox markers');
    }
    
    try {
      let markers = '';
      
      if (incidents && incidents.length > 0) {
        // Check if Cloudinary is configured
        if (cloudName) {
          // Use PNG markers from Cloudinary for all incidents
          markers = incidents.map(incident => {
            // Get color name based on incident type
            const colorName = getMarkerColorNameByType(incident.type);
            
            // Format using custom marker functionality with Cloudinary PNG markers
            // Format: url-https://res.cloudinary.com/cloud-name/image/upload/path/file({lon},{lat})
            return `url-https://res.cloudinary.com/${cloudName}/image/upload/markers/_${colorName}.png(${incident.longitude},${incident.latitude})`;
          }).join(',');
        } else {
          // Fallback to standard Mapbox markers if Cloudinary isn't configured
          markers = incidents.map(incident => {
            // Get color based on incident type
            const color = getMarkerColorByType(incident.type);
            
            // Use small pins with danger Maki icon (skull and crossbones)
            // Format: pin-s-{icon}+{color}({lon},{lat})
            return `pin-s-danger+${color}(${incident.longitude},${incident.latitude})`;
          }).join(',');
        }
      } else if (center && center.length === 2) {
        // If no incidents, put a single marker at the center
        if (cloudName) {
          markers = `url-https://res.cloudinary.com/${cloudName}/image/upload/markers/_red.png(${center[0]},${center[1]})`;
        } else {
          markers = `pin-s-danger+f00(${center[0]},${center[1]})`;
        }
      }
      
      // Use the exact same custom map style as in MaritimeMap
      const mapStyle = 'mara-admin/clsbsqqvb011f01qqfwo95y4q';
      
      // Generate the static map URL according to Mapbox docs with updated dimensions (850x300)
      const url = `https://api.mapbox.com/styles/v1/${mapStyle}/static/${
        markers
      }/${center[0]},${center[1]},${zoom},0/850x300@2x?access_token=${mapboxToken}`;
      
      setMapUrl(url);
      
      // Create fallback URL with standard mapbox style and fallback marker
      if (cloudName) {
        setFallbackUrl(`https://api.mapbox.com/styles/v1/mapbox/light-v11/static/url-https://res.cloudinary.com/${cloudName}/image/upload/markers/_red.png(${center[0]},${center[1]})/${center[0]},${center[1]},${zoom},0/850x300@2x?access_token=${mapboxToken}`);
      } else {
        setFallbackUrl(`https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s-danger+f00(${center[0]},${center[1]})/${center[0]},${center[1]},${zoom},0/850x300@2x?access_token=${mapboxToken}`);
      }
    } catch (err) {
      console.error('Error generating static map URL:', err);
      setError(true);
    }
  }, [incidents, center, zoom]);
  
  // Show loading or error state
  if (error) {
    return (
      <div className={className} style={style}>
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <p className="text-gray-500 text-sm">Map could not be loaded</p>
        </div>
      </div>
    );
  }
  
  if (!mapUrl) {
    return (
      <div className={className} style={style}>
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <p className="text-gray-500 text-sm">Loading map...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={className} style={style}>
      <img
        src={useFallback ? fallbackUrl : mapUrl}
        alt="Map showing incident location"
        className="w-full h-full object-cover rounded-lg"
        loading="lazy"
        onError={(e) => {
          console.warn('Error loading static map, trying fallback');
          // If we're already using the fallback, show an error
          if (useFallback) {
            setError(true);
          } else {
            setUseFallback(true);
          }
        }}
      />
    </div>
  );
};

/**
 * Get an appropriate marker color based on incident type (hex code)
 * Used for the original Mapbox pin markers as a fallback
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

/**
 * Get the marker color name based on incident type (for use with Cloudinary PNG markers)
 * Maps the normalized incident type to the corresponding color name in the Cloudinary markers folder
 * Each file is named according to its color preceded by an underscore (i.e., _cyan.png, _green.png, _red.png, etc.)
 */
function getMarkerColorNameByType(type) {
  if (!type) return 'gray'; // Default
  
  const lowerType = String(type).toLowerCase();
  
  // Normalize type using the same logic as in MaritimeMap
  const normalizedType = normalizeIncidentType(lowerType);
  
  // Return color name based on normalized type - match filenames in Cloudinary markers folder
  const typeColorNames = {
    'violent': 'red',
    'robbery': 'green',
    'military': 'purple',
    'suspicious': 'orange',
    'cyber': 'cyan',
    'smuggling': 'magenta',
    'default': 'gray'
  };
  
  return typeColorNames[normalizedType] || typeColorNames.default;
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