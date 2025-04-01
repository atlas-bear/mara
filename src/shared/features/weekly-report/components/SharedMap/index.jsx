import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * SimpleMap component for displaying maritime incidents
 * This is a simplified version that doesn't try to share map instances
 * 
 * @component
 * @param {Object} props
 * @param {string} props.mapId - ID for the map (for debugging)
 * @param {Array} props.incidents - Array of incident objects to display
 * @param {Array} props.center - Initial center coordinates [longitude, latitude]
 * @param {number} props.zoom - Initial zoom level
 * @param {boolean} props.useClustering - Whether to enable marker clustering
 * @param {string} props.className - CSS class name for the container
 * @param {Object} props.style - Inline styles for the container
 */
const SharedMap = ({ 
  mapId = 'map', 
  incidents = [], 
  center = [0, 0], 
  zoom = 1, 
  useClustering = false,
  className = "w-full h-[300px] rounded-lg",
  style = { border: '1px solid #e5e7eb' }
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [error, setError] = useState(false);
  
  // Count instance for limiting total WebGL contexts
  if (typeof window !== 'undefined') {
    window.__maraMapCount = window.__maraMapCount || 0;
    
    // Much higher limits with static circle markers
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    window.__maraMaxMaps = isSafari ? 30 : 50;
  }
  
  // Initialize the map
  useEffect(() => {
    // Check if we've reached the map instance limit
    if (typeof window !== 'undefined' && 
        window.__maraMapCount >= window.__maraMaxMaps) {
      console.log(`Map instance limit reached (${window.__maraMapCount}/${window.__maraMaxMaps})`);
      setError(true);
      return;
    }
    
    if (!mapContainer.current) return;
    
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.error('MapBox token not found in environment variables');
      setError(true);
      return;
    }
    
    if (map.current) {
      try {
        map.current.remove();
        
        // Decrement counter
        if (typeof window !== 'undefined' && window.__maraMapCount > 0) {
          window.__maraMapCount--;
        }
      } catch (e) {
        console.warn('Error removing map:', e);
      }
      map.current = null;
    }
    
    try {
      // Set access token
      mapboxgl.accessToken = token;
      
      // Create map
      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: center,
        zoom: zoom,
        preserveDrawingBuffer: true,
        attributionControl: false,
        navigationControl: false,
        failIfMajorPerformanceCaveat: false,
        maxZoom: 18,
        doubleClickZoom: true,
        dragRotate: false
      });
      
      // Increment map counter
      if (typeof window !== 'undefined') {
        window.__maraMapCount++;
        console.log(`Map created (${window.__maraMapCount}/${window.__maraMaxMaps})`);
      }
      
      // Store reference
      map.current = newMap;
      
      // Set up data when loaded
      newMap.on('load', () => {
        try {
          // Process incident data to valid GeoJSON features
          const features = incidents
            .map(incident => {
              // Normalize incident type
              const type = normalizeIncidentType(incident.type);
              
              // Parse coordinates
              const lng = parseFloat(incident.longitude);
              const lat = parseFloat(incident.latitude);
              
              if (isNaN(lng) || isNaN(lat)) {
                return null;
              }
              
              return {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [lng, lat]
                },
                properties: {
                  title: incident.title || 'Unknown Incident',
                  description: incident.description || '',
                  originalType: incident.type || 'unknown',
                  type: type
                }
              };
            })
            .filter(feature => feature !== null);
          
          // Add source
          newMap.addSource('incidents', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: features
            },
            cluster: useClustering,
            clusterMaxZoom: 14,
            clusterRadius: 50,
            maxzoom: 16,
            generateId: true
          });
          
          // Define colors for incident types
          const typeColors = {
            'violent': '239,68,68',    // Red
            'robbery': '34,197,94',    // Green
            'military': '139,92,246',  // Purple
            'suspicious': '249,115,22', // Orange
            'cyber': '6,182,212',      // Cyan
            'smuggling': '168,85,247', // Purple-pink
            'default': '107,114,128'   // Gray
          };
          
          // Add cluster layers if clustering enabled
          if (useClustering) {
            // Clusters
            newMap.addLayer({
              id: 'clusters',
              type: 'circle',
              source: 'incidents',
              filter: ['has', 'point_count'],
              paint: {
                'circle-color': [
                  'step',
                  ['get', 'point_count'],
                  '#3b82f6', // Low (1-2): Blue
                  3, '#f59e0b', // Moderate (3-6): Orange
                  7, '#ef4444'  // High (7+): Red
                ],
                'circle-radius': [
                  'step',
                  ['get', 'point_count'],
                  18, // Small clusters
                  3, 25, // Medium clusters
                  7, 30  // Large clusters
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9
              }
            });
            
            // Cluster counts
            newMap.addLayer({
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
            
            // Cluster click handler
            newMap.on('click', 'clusters', (e) => {
              try {
                const features = newMap.queryRenderedFeatures(e.point, { 
                  layers: ['clusters'] 
                });
                
                if (features && features.length > 0) {
                  const clusterId = features[0].properties.cluster_id;
                  
                  newMap.getSource('incidents').getClusterExpansionZoom(
                    clusterId,
                    (err, zoom) => {
                      if (err) return;
                      
                      newMap.easeTo({
                        center: features[0].geometry.coordinates,
                        zoom: zoom
                      });
                    }
                  );
                }
              } catch (err) {
                console.warn('Error handling cluster click:', err);
              }
            });
            
            // Cursor styling for clusters
            newMap.on('mouseenter', 'clusters', () => {
              newMap.getCanvas().style.cursor = 'pointer';
            });
            
            newMap.on('mouseleave', 'clusters', () => {
              newMap.getCanvas().style.cursor = '';
            });
          }
          
          // Add layers for each incident type
          Object.entries(typeColors).forEach(([type, color]) => {
            // Parse color components
            const [r, g, b] = color.split(',').map(c => parseInt(c.trim()));
            
            // Add halo layer
            newMap.addLayer({
              id: `incidents-${type}-halo`,
              type: 'circle',
              source: 'incidents',
              filter: ['all', 
                ['!', ['has', 'point_count']],
                ['==', ['get', 'type'], type]
              ],
              paint: {
                'circle-radius': 10,
                'circle-color': `rgba(${r}, ${g}, ${b}, 0.3)`,
                'circle-stroke-width': 0,
                'circle-opacity': 0.6,
                'circle-blur': 0.5
              }
            });
            
            // Add main circle layer
            newMap.addLayer({
              id: `incidents-${type}`,
              type: 'circle',
              source: 'incidents',
              filter: ['all', 
                ['!', ['has', 'point_count']],
                ['==', ['get', 'type'], type]
              ],
              paint: {
                'circle-radius': 6,
                'circle-color': `rgb(${r}, ${g}, ${b})`,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9
              }
            });
          });
          
          // Set up popups for individual incidents
          const incidentLayers = Object.keys(typeColors).map(type => `incidents-${type}`);
          
          incidentLayers.forEach(layerId => {
            // Show popup on click
            newMap.on('click', layerId, (e) => {
              try {
                if (!e.features || e.features.length === 0) return;
                
                const coordinates = e.features[0].geometry.coordinates.slice();
                const { title, description, originalType } = e.features[0].properties;
                
                new mapboxgl.Popup()
                  .setLngLat(coordinates)
                  .setHTML(`
                    <h3 class="font-bold">${title || 'Unknown'}</h3>
                    <p>${description || 'No description'}</p>
                    <p class="text-xs text-gray-500 mt-2">Type: ${originalType || 'Unknown'}</p>
                  `)
                  .addTo(newMap);
              } catch (err) {
                console.warn('Error creating popup:', err);
              }
            });
            
            // Change cursor on hover
            newMap.on('mouseenter', layerId, () => {
              newMap.getCanvas().style.cursor = 'pointer';
            });
            
            newMap.on('mouseleave', layerId, () => {
              newMap.getCanvas().style.cursor = '';
            });
          });
          
          console.log(`Map ${mapId} setup complete with ${features.length} incidents`);
        } catch (err) {
          console.error(`Error setting up map ${mapId}:`, err);
          setError(true);
        }
      });
      
      // Handle errors
      newMap.on('error', (e) => {
        console.error(`Map ${mapId} error:`, 
          e.error ? (e.error.message || 'Unknown error') : 'Unknown error'
        );
      });
      
      // Clean up on unmount
      return () => {
        if (map.current) {
          try {
            // Clean up WebGL context
            if (map.current.getCanvas && map.current.getCanvas()) {
              try {
                const gl = map.current.getCanvas().getContext('webgl') || 
                          map.current.getCanvas().getContext('experimental-webgl');
                          
                if (gl) {
                  const extension = gl.getExtension('WEBGL_lose_context');
                  if (extension) {
                    extension.loseContext();
                  }
                }
              } catch (e) {
                console.warn('Failed to clean up WebGL context:', e);
              }
            }
            
            // Remove the map
            map.current.remove();
            
            // Decrement counter
            if (typeof window !== 'undefined' && window.__maraMapCount > 0) {
              window.__maraMapCount--;
              console.log(`Map removed (${window.__maraMapCount}/${window.__maraMaxMaps})`);
            }
          } catch (e) {
            console.error('Error removing map:', e);
          }
          
          map.current = null;
        }
      };
    } catch (e) {
      console.error(`Error initializing map ${mapId}:`, e);
      setError(true);
    }
  }, [mapId]); // Only recreate on ID change
  
  // Update map center and zoom when props change
  useEffect(() => {
    if (!map.current) return;
    
    try {
      // If the map is loaded, update the position
      if (map.current.loaded()) {
        map.current.jumpTo({
          center: center,
          zoom: zoom
        });
      } else {
        // If not loaded, set event handler
        map.current.once('load', () => {
          map.current.jumpTo({
            center: center,
            zoom: zoom
          });
        });
      }
    } catch (e) {
      console.warn(`Error updating map ${mapId} position:`, e);
    }
  }, [center, zoom]);
  
  // Update incident data when changed
  useEffect(() => {
    if (!map.current) return;
    
    try {
      const updateSource = () => {
        // Process incident data
        const features = incidents
          .map(incident => {
            // Normalize type
            const type = normalizeIncidentType(incident.type);
            
            // Parse coordinates
            const lng = parseFloat(incident.longitude);
            const lat = parseFloat(incident.latitude);
            
            if (isNaN(lng) || isNaN(lat)) {
              return null;
            }
            
            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              properties: {
                title: incident.title || 'Unknown Incident',
                description: incident.description || '',
                originalType: incident.type || 'unknown',
                type: type
              }
            };
          })
          .filter(feature => feature !== null);
        
        // Update the source if it exists
        if (map.current.getSource('incidents')) {
          map.current.getSource('incidents').setData({
            type: 'FeatureCollection',
            features: features
          });
          
          console.log(`Map ${mapId} updated with ${features.length} incidents`);
        }
      };
      
      // Update immediately if map is loaded
      if (map.current.loaded() && map.current.getSource('incidents')) {
        updateSource();
      } else {
        // Otherwise wait for load event
        map.current.once('load', updateSource);
      }
    } catch (e) {
      console.warn(`Error updating map ${mapId} data:`, e);
    }
  }, [incidents]);
  
  // Helper function to normalize incident types
  const normalizeIncidentType = (type) => {
    if (!type) return 'default';
    
    // Convert to lowercase for matching
    const lowerType = String(type).toLowerCase().trim();
    
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
    
    // Handle "unknown" type
    if (lowerType === 'unknown' || lowerType === 'unknown type') {
      return 'suspicious';
    }
    
    // Default for uncategorized
    return 'default';
  };
  
  // Show error or limit message
  if (error) {
    return (
      <div className={className} style={style}>
        <div className="h-full bg-gray-100 flex items-center justify-center rounded-lg">
          <p className="text-gray-500 text-sm text-center p-4">
            {window.__maraMapCount >= window.__maraMaxMaps 
              ? `Too many maps on this page. Please view earlier maps for details.` 
              : `Unable to load map. Please refresh to try again.`}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={mapContainer}
      className={className}
      style={style}
    />
  );
};

export default SharedMap;