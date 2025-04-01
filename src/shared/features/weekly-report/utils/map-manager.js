/**
 * Map Manager - Handles shared map instances for the weekly report
 * 
 * This module manages a pool of shared map instances to reduce the number
 * of WebGL contexts created across the report, which helps prevent
 * the "too many WebGL contexts" error in browsers like Safari.
 */

// Define region map IDs
export const MAP_IDS = {
  GLOBAL: 'global',
  WEST_AFRICA: 'west-africa',
  SOUTHEAST_ASIA: 'southeast-asia',
  INDIAN_OCEAN: 'indian-ocean',
  AMERICAS: 'americas',
  EUROPE: 'europe'
};

// Map instances storage - avoid using React state to prevent rerenders
const mapInstances = typeof window !== 'undefined' ? new Map() : null;
const mapStatus = typeof window !== 'undefined' ? {} : null;

/**
 * Get a map instance for the given ID
 * @param {string} mapId - ID of the map to get
 * @returns {Object|null} - Map instance or null if not found
 */
export const getMapInstance = (mapId) => {
  if (!mapInstances) return null;
  return mapInstances.get(mapId) || null;
};

/**
 * Check if a map with the given ID is loaded
 * @param {string} mapId - ID of the map to check
 * @returns {boolean} - Whether the map is loaded
 */
export const isMapLoaded = (mapId) => {
  const mapInfo = getMapInstance(mapId);
  return mapInfo && mapInfo.loaded;
};

/**
 * Mount a map to a container
 * @param {string} mapId - ID for the map
 * @param {HTMLElement} container - DOM container element
 * @param {Object} mapboxgl - The mapboxgl library
 * @param {Object} options - Map options
 * @returns {Object|null} - Map info object or null if failed
 */
export const mountMap = (mapId, container, mapboxgl, options = {}) => {
  if (!mapboxgl) {
    console.error('MapBox GL library not provided');
    return null;
  }
  
  // We don't expect token to be passed in options, it's set directly on mapboxgl
  try {
    console.log(`Mounting map ${mapId} to container`, { 
      containerId: container.id,
      containerClass: container.className,
      hasToken: !!mapboxgl.accessToken
    });
    
    // Check if token is already set
    if (!mapboxgl.accessToken) {
      console.error('MapBox token not set on mapboxgl.accessToken');
      return null;
    }
    
    // Default style that's more reliable
    const defaultStyle = 'mapbox://styles/mapbox/light-v11';
    const customStyle = 'mapbox://styles/mara-admin/clsbsqqvb011f01qqfwo95y4q';
    
    // Create the map
    const map = new mapboxgl.Map({
      container,
      style: customStyle,
      center: options.center || [0, 0],
      zoom: options.zoom || 1,
      preserveDrawingBuffer: true,
      attributionControl: false,
      navigationControl: false,
      failIfMajorPerformanceCaveat: false,
      localFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif",
      maxZoom: 18,
      interactive: true,
      boxZoom: true,
      dragRotate: false,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: false,
      fadeDuration: 0
    });
    
    // Add error handler for style loading
    map.on('style.load', () => {
      // Map style loaded successfully
    });
    
    // Handle various error scenarios
    map.on('error', (e) => {
      console.warn('MapBox error captured:', e.error ? e.error.message || 'Unknown error' : 'Unknown error');
      
      // Style loading error fallback
      if (e.error && ((e.error.status === 404 && e.error.url && e.error.url.includes('styles')) ||
                      (e.error.status === 401))) {
        console.warn('Custom map style issue, falling back to default style');
        try {
          map.setStyle(defaultStyle);
        } catch (styleError) {
          console.warn('Failed to set fallback style:', styleError);
        }
      }
    });
    
    // Store the map instance
    const mapInfo = { map, container, options, loaded: false };
    mapInstances.set(mapId, mapInfo);
    
    // Update status
    mapStatus[mapId] = 'mounted';
    
    // When the map is loaded, initialize the layer
    map.on('load', () => {
      mapInfo.loaded = true;
      mapStatus[mapId] = 'loaded';
    });
    
    return mapInfo;
  } catch (error) {
    console.error('Error initializing map:', error);
    mapStatus[mapId] = 'error';
    return null;
  }
};

/**
 * Update map data and configuration
 * @param {string} mapId - ID of the map to update
 * @param {Array} incidents - Array of incidents to display
 * @param {Object} options - Map options
 * @returns {boolean} - Whether the update was successful
 */
export const updateMap = (mapId, incidents = [], options = {}) => {
  const mapInfo = mapInstances ? mapInstances.get(mapId) : null;
  if (!mapInfo || !mapInfo.map || !mapInfo.loaded) return false;
  
  const map = mapInfo.map;
  
  try {
    // Zoom to new center/zoom if provided
    if (options.center && options.zoom) {
      // Use easeTo instead of jumpTo for smoother transitions
      // and to avoid potential issues with rapid changes
      map.easeTo({
        center: options.center,
        zoom: options.zoom,
        duration: 0 // Immediate for initial load
      });
    }
    
    // Check map status to troubleshoot
    console.log(`Map ${mapId} update:`, { 
      center: options.center, 
      zoom: options.zoom,
      incidentCount: incidents.length,
      mapLoaded: map.loaded(),
      currentCenter: map.getCenter(),
      currentZoom: map.getZoom()
    });
    
    // Check if we already have the incidents source
    let sourceExists = false;
    try {
      sourceExists = !!map.getSource('incidents');
    } catch (e) {
      sourceExists = false;
    }
    
    // Helper function to normalize incident types
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
    
    // Define category colors
    const typeColors = {
      'violent': '239,68,68',    // Red - Attack, Boarding, Piracy, Kidnapping, etc.
      'robbery': '34,197,94',    // Green - Robbery, Theft
      'military': '139,92,246',  // Purple - Military, Navy, Firing Exercise
      'suspicious': '249,115,22', // Orange - Suspicious, Advisory, Irregular, Sighting
      'cyber': '6,182,212',      // Cyan - Cyber incidents
      'smuggling': '168,85,247', // Purple-pink - Smuggling
      'default': '107,114,128'   // Gray - Fallback for uncategorized
    };
    
    // If the source does not exist yet, create it
    if (!sourceExists) {
      // Create GeoJSON data from incidents with validation
      const features = incidents.map(incident => {
        // Get normalized category for this incident type
        const normalizedType = normalizeIncidentType(incident.type);
        
        // Make sure coordinates are numbers
        const longitude = parseFloat(incident.longitude);
        const latitude = parseFloat(incident.latitude);
        
        // Skip invalid coordinates
        if (isNaN(longitude) || isNaN(latitude)) {
          console.warn('Invalid coordinates in incident', incident);
          return null;
        }
        
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          properties: {
            title: incident.title || 'Unknown Incident',
            description: incident.description || '',
            originalType: incident.type || 'unknown',
            type: normalizedType
          }
        };
      }).filter(feature => feature !== null);
      
      console.log(`Creating source for map ${mapId}:`, {
        featureCount: features.length,
        source: 'incidents'
      });
      
      const geoJsonData = {
        type: 'FeatureCollection',
        features: features
      };
      
      // Add source and clustering settings
      map.addSource('incidents', {
        type: 'geojson',
        data: geoJsonData,
        cluster: options.useClustering || false,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        maxzoom: 16,
        generateId: true,
        buffer: 128,
        tolerance: 0.375
      });
      
      // Add cluster layer if clustering is enabled
      if (options.useClustering) {
        // Add a layer for the clusters
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'incidents',
          filter: ['has', 'point_count'],
          minzoom: 0,
          maxzoom: 16,
          paint: {
            // Use threat level colors that match our severity scale
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#3b82f6', // Low (1-2 incidents): Blue
              3, '#f59e0b', // Moderate (3-6 incidents): Orange
              7, '#ef4444'  // Substantial/Critical (7+ incidents): Red
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              18, // Small clusters
              3, 25, // Medium clusters
              7, 30  // Large clusters
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
            'circle-opacity': 0.9,
            'circle-stroke-opacity': 1
          }
        });
        
        // Add a layer for the cluster count
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'incidents',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
          },
          paint: {
            'text-color': '#ffffff'
          }
        });
      }
      
      // Add layers for individual incident points using circles with halos
      Object.entries(typeColors).forEach(([type, color]) => {
        // Parse the color components
        const [r, g, b] = color.split(',').map(c => parseInt(c.trim()));
        
        // First add a larger "halo" circle for each point for better visibility
        map.addLayer({
          id: `incidents-${type}-halo`,
          type: 'circle',
          source: 'incidents',
          // Only show unclustered points of this type
          filter: ['all', 
            ['!', ['has', 'point_count']],
            ['==', ['get', 'type'], type]
          ],
          paint: {
            // Outer halo
            'circle-radius': 10,  // Larger radius for the halo
            'circle-color': `rgba(${r}, ${g}, ${b}, 0.3)`,  // Transparent version of the main color
            'circle-stroke-width': 0,
            
            // Make the halo stand out
            'circle-opacity': 0.6,
            'circle-blur': 0.5  // Slight blur for a glow effect
          }
        });
        
        // Then add the main circle on top
        map.addLayer({
          id: `incidents-${type}`,
          type: 'circle',
          source: 'incidents',
          // Only show unclustered points of this type
          filter: ['all', 
            ['!', ['has', 'point_count']],
            ['==', ['get', 'type'], type]
          ],
          paint: {
            // Main circle
            'circle-radius': 6,  // Slightly larger than before
            'circle-color': `rgb(${r}, ${g}, ${b})`,
            'circle-stroke-width': 2,  // Thicker border
            'circle-stroke-color': '#ffffff',
            
            // Make the circle stand out
            'circle-opacity': 0.9,
            'circle-stroke-opacity': 1
          }
        });
      });
      
      // List of all layer IDs for event handling (main circles only, not halos)
      const allLayerIds = Object.keys(typeColors).map(type => `incidents-${type}`);
      
      // Handle cluster clicks - zoom in when a cluster is clicked
      if (options.useClustering) {
        map.on('click', 'clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          const clusterId = features[0].properties.cluster_id;
          
          // Get the cluster expansion zoom
          map.getSource('incidents').getClusterExpansionZoom(
            clusterId,
            (err, zoom) => {
              if (err) return;
              
              // Zoom to the cluster
              map.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom
              });
            }
          );
        });
        
        // Change cursor on hover for clusters
        map.on('mouseenter', 'clusters', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', 'clusters', () => {
          map.getCanvas().style.cursor = '';
        });
      }
      
      // Add popups on click for individual incident types
      map.on('click', allLayerIds, (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const { title, description, originalType, type } = e.features[0].properties;

        // Get the constructor of the map to create a popup
        // This allows us to use the same mapboxgl instance without passing it
        const Popup = map.constructor.Popup;
        if (Popup) {
          new Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <h3 class="font-bold">${title}</h3>
              <p>${description}</p>
              <p class="text-xs text-gray-500 mt-2">Incident type: ${originalType}</p>
            `)
            .addTo(map);
        }
      });

      // Change cursor on hover for all incident types
      map.on('mouseenter', allLayerIds, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', allLayerIds, () => {
        map.getCanvas().style.cursor = '';
      });
    } else {
      // If the source already exists, create a valid GeoJSON even with empty incidents
      const features = incidents.map(incident => {
        // Get normalized category for this incident type
        const normalizedType = normalizeIncidentType(incident.type);
        
        // Make sure coordinates are numbers
        const longitude = parseFloat(incident.longitude);
        const latitude = parseFloat(incident.latitude);
        
        // Skip invalid coordinates
        if (isNaN(longitude) || isNaN(latitude)) {
          console.warn('Invalid coordinates in incident', incident);
          return null;
        }
        
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          properties: {
            title: incident.title || 'Unknown Incident',
            description: incident.description || '',
            originalType: incident.type || 'unknown',
            type: normalizedType
          }
        };
      }).filter(feature => feature !== null);
      
      console.log(`Updating source for map ${mapId}:`, {
        featureCount: features.length,
        source: 'incidents'
      });
      
      // Update the source with the filtered features
      map.getSource('incidents').setData({
        type: 'FeatureCollection',
        features: features
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error updating map:', error);
    return false;
  }
};

/**
 * Unmount a map and clean up resources
 * @param {string} mapId - ID of the map to unmount
 * @returns {boolean} - Whether the unmount was successful
 */
export const unmountMap = (mapId) => {
  if (!mapInstances) return false;
  
  const mapInfo = mapInstances.get(mapId);
  if (!mapInfo) return false;
  
  try {
    if (mapInfo.map) {
      mapInfo.map.remove();
    }
    mapInstances.delete(mapId);
    mapStatus[mapId] = 'unmounted';
    return true;
  } catch (error) {
    console.error('Error unmounting map:', error);
    return false;
  }
};

export default { 
  MAP_IDS,
  getMapInstance,
  isMapLoaded,
  mountMap,
  updateMap,
  unmountMap
};