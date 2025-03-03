/**
 * Map utilities for static map generation using MapBox
 * This file provides functions to generate static map URLs for use in email templates
 * and other static contexts where an interactive map isn't suitable.
 */

/**
 * Generates a static map image URL using MapBox API
 * @param {Object} options Map generation options
 * @param {number} options.latitude Incident latitude
 * @param {number} options.longitude Incident longitude
 * @param {number} options.zoom Map zoom level (1-18)
 * @param {string} options.incidentType Type of incident for marker styling 
 * @returns {Promise<string>} URL to the generated map image
 */
export const generateMapImage = async ({ latitude, longitude, zoom = 6, incidentType = 'unknown' }) => {
  if (!latitude || !longitude) {
    throw new Error('Latitude and longitude are required');
  }

  try {
    // Define marker appearance based on incident type
    const markerColor = getMarkerColorByType(incidentType);
    
    // Create a marker for the incident location
    const marker = `pin-l+${markerColor.replace('#', '')}(${longitude},${latitude})`;
    
    // Define map style - using satellite by default
    const mapStyle = 'mapbox.satellite';
    
    // Generate MapBox Static API URL
    // Documentation: https://docs.mapbox.com/api/maps/static-images/
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    const staticMapUrl = `https://api.mapbox.com/styles/v1/${mapStyle}/static/${marker}/${longitude},${latitude},${zoom},0/600x400@2x?access_token=${mapboxToken}`;
    
    return staticMapUrl;
  } catch (error) {
    console.error('Error generating map image:', error);
    // Return a placeholder image in case of error
    return 'https://placehold.co/600x400?text=Map+Not+Available';
  }
};

/**
 * Get an appropriate marker color based on incident type
 * @param {string} incidentType Type of incident
 * @returns {string} Hex color code for marker
 */
const getMarkerColorByType = (incidentType) => {
  const type = incidentType?.toLowerCase() || 'unknown';
  
  const typeColorMap = {
    'piracy': '#FF0000',       // Red
    'robbery': '#FF4500',      // Orange Red
    'hijacking': '#B22222',    // FireBrick
    'kidnapping': '#8B0000',   // Dark Red
    'suspicious': '#FFA500',   // Orange
    'approach': '#FFFF00',     // Yellow
    'attack': '#FF0000',       // Red
    'theft': '#FF8C00',        // Dark Orange
    'boarding': '#FF4500',     // Orange Red
    'default': '#FF0000'       // Default Red
  };
  
  return typeColorMap[type] || typeColorMap.default;
};

/**
 * Simple static map URL generator using MapBox
 * @param {Object} coordinates Latitude and longitude
 * @param {Object} options Map options
 * @returns {string} URL to a static map
 */
export const generateStaticMap = (coordinates, options = {}) => {
  if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
    return '';
  }
  
  const { latitude, longitude } = coordinates;
  const zoom = options.zoom || 6;
  const width = options.width || 600;
  const height = options.height || 400;
  
  // Get hex color without # for MapBox
  const color = (options.markerColor || 'ff0000').replace('#', '');
  
  // Create a marker for the location
  const marker = `pin-l+${color}(${longitude},${latitude})`;
  
  // Define map style - using satellite by default
  const mapStyle = 'mapbox.satellite';
  
  // Generate MapBox Static API URL
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
  
  return `https://api.mapbox.com/styles/v1/${mapStyle}/static/${marker}/${longitude},${latitude},${zoom},0/${width}x${height}@2x?access_token=${mapboxToken}`;
};