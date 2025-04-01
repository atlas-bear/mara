import React from 'react';

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
  // Get Mapbox token from environment
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  
  if (!token) {
    return (
      <div className={className} style={style}>
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <p className="text-gray-500 text-sm">Map token not available</p>
        </div>
      </div>
    );
  }
  
  // Process incidents to create markers
  const markers = incidents.map(incident => {
    // Get color based on incident type
    const color = getMarkerColorByType(incident.type);
    
    // Create marker string
    return `pin-l+${color.replace('#', '')}(${incident.longitude},${incident.latitude})`;
  }).join(',');
  
  // Use a light map style consistent with the interactive maps
  const mapStyle = 'mapbox/light-v11';
  
  // Generate the static map URL
  const mapUrl = `https://api.mapbox.com/styles/v1/${mapStyle}/static/${
    markers || `pin-l(${center[0]},${center[1]})`
  }/${center[0]},${center[1]},${zoom},0/600x300@2x?access_token=${token}`;
  
  return (
    <div className={className} style={style}>
      <img
        src={mapUrl}
        alt="Map showing incident location"
        className="w-full h-full object-cover rounded-lg"
        loading="lazy"
        onError={(e) => {
          console.warn('Error loading static map:', e);
          e.target.src = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-l(${center[0]},${center[1]})/${center[0]},${center[1]},${zoom},0/600x300@2x?access_token=${token}`;
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
  
  // Violent incidents - Red
  if (/attack|arm|weapon|assault|fire|shoot|boarding|board|piracy|hijack|kidnap|explosion|explosi/.test(lowerType)) {
    return 'EF4444';
  }
  
  // Robbery/theft - Green
  if (/robbery|theft|steal|stolen/.test(lowerType)) {
    return '22C55E';
  }
  
  // Military - Purple
  if (/military|navy|coast guard|firing exercise|exercise|drill/.test(lowerType)) {
    return '8B5CF6';
  }
  
  // Suspicious - Orange
  if (/suspicious|approach|attempt|advisory|alert|irregular|general alert|sighting|sight/.test(lowerType)) {
    return 'F97316';
  }
  
  // Other types
  if (/cyber/.test(lowerType)) return '06B6D4'; // Cyan
  if (/smuggl/.test(lowerType)) return 'A855F7'; // Purple-pink
  
  // Default - Gray
  return '6B7280';
}

export default StaticMap;