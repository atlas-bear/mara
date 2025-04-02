import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapStyles.css';

// Simpler, more reliable WebGL context tracking
if (typeof window !== 'undefined') {
  // Use a simple counter system that won't get mixed up
  window.__maraMapCount = window.__maraMapCount || 0;
  
  // Much higher limits are possible now with efficient circle layers
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  window.__maraMaxMaps = isSafari ? 30 : 50;
}

// More robust browser detection
const detectBrowser = () => {
  try {
    // Detect Safari
    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
      return 'safari';
    }
    
    // Detect iOS WebKit (used in all iOS browsers)
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
      return 'ios';
    }
    
    // Detect Firefox
    if (navigator.userAgent.indexOf('Firefox') !== -1) {
      return 'firefox';
    }
    
    // Detect Chrome
    if (navigator.userAgent.indexOf('Chrome') !== -1) {
      return 'chrome';
    }
    
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
};

const browserType = detectBrowser();
const isSafari = browserType === 'safari' || browserType === 'ios';

// Set a lower context limit for Safari
if (typeof window !== 'undefined' && window.__maraWebGLContexts && isSafari) {
  window.__maraWebGLContexts.maxContexts = 6;
}

/**
 * Interactive map component for displaying maritime incidents
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array<Object>} [props.incidents=[]] - Array of incident objects to display on the map
 * @param {Array<number>} [props.center=[103.8, 1.12]] - Initial map center coordinates [longitude, latitude]
 * @param {number} [props.zoom=8] - Initial zoom level
 * @param {boolean} [props.useClustering=true] - Whether to enable marker clustering
 * @returns {JSX.Element} Rendered map component
 */
const MaritimeMap = ({ 
  incidents = [], 
  center = [103.8, 1.12],
  zoom = 8,
  useClustering = true
}) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const [mapError, setMapError] = useState(false);
  const [mapWarning, setMapWarning] = useState(false);
  const [webGLLimitReached, setWebGLLimitReached] = useState(false);

  useLayoutEffect(() => {
    // Always clean up the previous map instance before creating a new one
    if (mapInstance.current) {
      try {
        // Explicitly remove all event listeners
        if (mapInstance.current.listeners) {
          for (const [event, handler] of Object.entries(mapInstance.current.listeners || {})) {
            mapInstance.current.off(event, handler);
          }
          mapInstance.current.listeners = {};
        }
        
        // Force texture and buffer cleanup - in v3 we do this differently
        try {
          // Try to manually trigger resource cleanup through public API
          // V3 handles cleanup more automatically
          if (mapInstance.current.getCanvas() && mapInstance.current.getCanvas().getContext) {
            const gl = mapInstance.current.getCanvas().getContext('webgl2') || 
                      mapInstance.current.getCanvas().getContext('webgl');
                      
            if (gl) {
              // Force context loss to release resources
              const extension = gl.getExtension('WEBGL_lose_context');
              if (extension) {
                extension.loseContext();
              }
            }
          }
        } catch (e) {
          console.warn('Failed to cleanup WebGL context:', e);
        }
        
        // Standard removal
        mapInstance.current.remove();
        mapInstance.current = null;
        
        // Force a garbage collection trigger (helps with Safari)
        setTimeout(() => {
          // The timeout helps browsers process the cleanup
          // before creating a new context
        }, 50);
      } catch (cleanupError) {
        console.warn('Error during map cleanup:', cleanupError);
      }
    }

    // Check if we've reached the map instance limit
    if (typeof window !== 'undefined' && 
        window.__maraMapCount >= window.__maraMaxMaps) {
      console.warn(`Map instance limit reached (${window.__maraMapCount}/${window.__maraMaxMaps}). Using static fallback.`);
      setWebGLLimitReached(true);
      return;
    }
    
    // Get MapBox token from environment
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.error('MapBox token not found in environment variables');
      setMapError(true);
      return;
    }

    try {
      // Set access token for MapBox GL
      mapboxgl.accessToken = token;
      
      // Suppress console errors for resource loading failures
      // This handles resource loading errors in a consistent way across versions
      const originalConsoleError = console.error;
      console.error = function(...args) {
        // Filter out the errors related to MapBox resource loading
        if (args[0] && 
            (typeof args[0] === 'string' && args[0].includes('Failed to load resource')) ||
            (args[0] instanceof Error && args[0].message && 
             (args[0].message.includes('Mapbox') || args[0].message.includes('resource')))) {
          console.warn('MapBox resource loading issue - this is expected and non-critical');
          return;
        }
        originalConsoleError.apply(console, args);
      };
      
      // Use a fallback style if the custom style fails
      const defaultStyle = 'mapbox://styles/mapbox/light-v11'; // More reliable style
      const customStyle = 'mapbox://styles/mara-admin/clsbsqqvb011f01qqfwo95y4q';
      
      // Instead of trying to modify readonly config properties,
      // we'll use a different approach to handle events.mapbox.com errors
      
      // Create map with settings for v3 compatibility
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: customStyle,
        center: center,
        zoom: zoom,
        preserveDrawingBuffer: true,
        attributionControl: false,
        navigationControl: false,
        failIfMajorPerformanceCaveat: false, // More permissive rendering
        localFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif", // Updated font fallbacks property
        maxZoom: 18,
        interactive: true, // Keep map interactive
        boxZoom: true,
        dragRotate: false, // Simplify interaction model
        touchZoomRotate: true,
        doubleClickZoom: true,
        keyboard: false, // Disable unnecessary keyboard handlers
        fadeDuration: 0, // Reduce animations
        preserveDrawingBuffer: true,
        trackUserLocation: false, // Don't track user location
        pitchWithRotate: false, // Simplify 3D
        renderWorldCopies: true, // For global views
        optimizeForTerrain: false, // No terrain in this app
        testMode: false, // Production mode
        
        // Safari-specific optimizations
        performanceMetricsCollection: false,
        collectResourceTiming: false,
        crossSourceCollisions: false, // Improve performance with many points
      });
      
      // Add error handler specifically for style loading
      map.on('style.load', () => {
        // Map style loaded successfully
      });
      
      // Handle various error scenarios including resource loading
      map.on('error', (e) => {
        // Don't crash on tile loading errors, just log them
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
        
        // Show warning indicator for non-critical errors (resource loading)
        if (e.error && (e.error.status === 404 || e.error.message?.includes('v2'))) {
          setMapWarning(true);
        }
        
        // Critical errors that prevent map usage
        if (e.error && [401, 403, 500].includes(e.error.status)) {
          setMapError(true);
        }
      });
      
      // Restore console.error after map creation
      setTimeout(() => {
        console.error = originalConsoleError;
      }, 5000); // Give map time to load resources

      map.on('load', () => {
        // Use simple circle layers instead of custom images
        // This is more reliable and efficient

        /**
         * Normalizes incident types into predefined categories for consistent display
         * 
         * @param {string} type - The raw incident type from the data
         * @returns {string} Normalized category: 'violent', 'robbery', 'military', 'suspicious', 'cyber', 'smuggling', or 'default'
         * @private
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
        
        // Define category colors according to requested scheme
        const typeColors = {
          'violent': '239,68,68',    // Red - Attack, Boarding, Piracy, Kidnapping, etc.
          'robbery': '34,197,94',    // Green - Robbery, Theft
          'military': '139,92,246',  // Purple - Military, Navy, Firing Exercise
          'suspicious': '249,115,22', // Orange - Suspicious, Advisory, Irregular, Sighting
          'cyber': '6,182,212',      // Cyan - Cyber incidents
          'smuggling': '168,85,247', // Purple-pink - Smuggling
          'default': '107,114,128'   // Gray - Fallback for uncategorized
        };
        
        // We'll use circle layers instead of images for better compatibility

        // Add source and layer for incidents with normalized types and optional clustering
        map.addSource('incidents', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: incidents.map(incident => {
              // Get normalized category for this incident type
              const normalizedType = normalizeIncidentType(incident.type);
              
              return {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [incident.longitude, incident.latitude]
                },
                properties: {
                  title: incident.title,
                  description: incident.description,
                  originalType: incident.type,
                  type: normalizedType
                }
              };
            })
          },
          // Enable clustering for performance and to handle many incidents
          cluster: useClustering,
          clusterMaxZoom: 14,  // Max zoom level for clusters
          clusterRadius: 50,   // Radius to cluster points
          maxzoom: 16,         // Maximum zoom level to cache source data for
          generateId: true,    // Generates a unique id for each feature (improves performance)
          buffer: 128,         // Tile buffer size (higher = smoother clustering)
          tolerance: 0.375     // Simplification tolerance (higher = better performance)
        });

        // Add cluster layer if clustering is enabled
        if (useClustering) {
          // Add a layer for the clusters
          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'incidents',
            filter: ['has', 'point_count'],
            minzoom: 0,   // Visible at all zoom levels
            maxzoom: 16,  // But not at very high zoom
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
        
        // Create pulsing dot images for each type of incident
        Object.entries(typeColors).forEach(([type, color]) => {
          // Parse the color components
          const [r, g, b] = color.split(',').map(c => parseInt(c.trim()));
          
          // Create pulsing dot function
          const size = 200;
          const pulsingDot = {
            width: size,
            height: size,
            data: new Uint8Array(size * size * 4),
            
            // Update the pulse function
            onAdd: function() {
              const canvas = document.createElement('canvas');
              canvas.width = this.width;
              canvas.height = this.height;
              this.context = canvas.getContext('2d');
            },
            
            // This is run every time the map needs the dot image
            render: function() {
              const duration = 1500;
              const t = (performance.now() % duration) / duration;
              
              const radius = (size / 2) * 0.3;
              const outerRadius = (size / 2) * 0.7 * t + radius;
              const context = this.context;
              
              // Clear canvas
              context.clearRect(0, 0, this.width, this.height);
              
              // Draw outer circle - pulsing part
              context.beginPath();
              context.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
              context.fillStyle = `rgba(${r}, ${g}, ${b}, ${1 - t})`;
              context.fill();
              
              // Draw inner circle - solid part
              context.beginPath();
              context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
              context.fillStyle = `rgb(${r}, ${g}, ${b})`;
              context.strokeStyle = 'white';
              context.lineWidth = 2;
              context.fill();
              context.stroke();
              
              // Update this image
              this.data = context.getImageData(0, 0, this.width, this.height).data;
              
              // Keep rendering indefinitely
              map.triggerRepaint();
              
              // Return true to keep rendering
              return true;
            }
          };
          
          // Add the pulsing dot as a map image
          map.addImage(`pulsing-dot-${type}`, pulsingDot, { pixelRatio: 2 });
          
          // Add a layer for this type
          map.addLayer({
            id: `incidents-${type}`,
            type: 'symbol',
            source: 'incidents',
            filter: ['all', 
              ['!', ['has', 'point_count']],
              ['==', ['get', 'type'], type]
            ],
            layout: {
              'icon-image': `pulsing-dot-${type}`,
              'icon-size': 0.6, // Increased size for better visibility
              'icon-allow-overlap': true,
              'icon-ignore-placement': true
            }
          });
        });

        // List of all layer IDs for event handling (main circles only, not halos)
        const allLayerIds = Object.keys(typeColors).map(type => `incidents-${type}`);
        
        // Handle cluster clicks - zoom in when a cluster is clicked
        if (useClustering) {
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

          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <h3 class="font-bold">${title}</h3>
              <p>${description}</p>
              <p class="text-xs text-gray-500 mt-2">Incident type: ${originalType}</p>
            `)
            .addTo(map);
        });

        // Change cursor on hover for all incident types
        map.on('mouseenter', allLayerIds, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', allLayerIds, () => {
          map.getCanvas().style.cursor = '';
        });
      });

      // Initialize event listener tracking object
      map.listeners = {};
      
      // Use custom tracking for event listeners
      const trackEvent = (event, handler) => {
        map.listeners[event] = handler;
        map.on(event, handler);
      };
      
      mapInstance.current = map;

      // Register map instance with our counter
      if (typeof window !== 'undefined') {
        window.__maraMapCount++;
        console.log(`Map created (${window.__maraMapCount}/${window.__maraMaxMaps})`);
      }

      // Track error listener
      trackEvent('error', (e) => {
        console.error('Map error:', e);
        setMapError(true);
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError(true);
    }

    return () => {
      if (mapInstance.current) {
        try {
          // Get the WebGL context before removing the map
          let gl = null;
          try {
            const canvas = mapInstance.current.getCanvas();
            if (canvas) {
              // Get the WebGL context
              gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            }
          } catch (e) {
            console.warn('Error getting WebGL context:', e);
          }
          
          // Remove all event listeners to prevent memory leaks
          mapInstance.current.off();
          
          // Remove the map instance
          mapInstance.current.remove();
          
          // Unregister map instance by decrementing counter
          if (typeof window !== 'undefined' && window.__maraMapCount > 0) {
            window.__maraMapCount--;
            console.log(`Map removed (${window.__maraMapCount}/${window.__maraMaxMaps})`);
          }

          // If we got the WebGL context, release it manually
          if (gl) {
            // Call lose context extension to release the context
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
              loseContext.loseContext();
            }
            
            // Manual WebGL cleanup
            const numTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
            for (let unit = 0; unit < numTextureUnits; ++unit) {
              gl.activeTexture(gl.TEXTURE0 + unit);
              gl.bindTexture(gl.TEXTURE_2D, null);
              gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
            }
            
            // Unbind buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            gl.bindRenderbuffer(gl.RENDERBUFFER, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            
            // Clear the canvas one last time
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
          }
          
          // Clear the reference
          mapInstance.current = null;
          
          // Force garbage collection via timeout
          setTimeout(() => {
            // This log statement forces a closure to execute after a timeout,
            // which can help browser garbage collection work more efficiently
            console.log('Map cleanup complete');
          }, 100);
        } catch (e) {
          console.warn('Error during map cleanup:', e);
          // Still try to clean up as best we can
          if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
          }
        }
      }
    };
  // Recreate the map if we have a large number of incidents (more than 20)
  // This helps prevent the "too many WebGL contexts" error
  }, [incidents.length > 20]);

  // Update markers when incidents change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.loaded() || !map.getSource('incidents')) return;

    // Function to normalize incident types (should match the one in the init effect)
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

    // Update the GeoJSON data with the same properties
    map.getSource('incidents').setData({
      type: 'FeatureCollection',
      features: incidents.map(incident => {
        // Get normalized category for this incident type
        const normalizedType = normalizeIncidentType(incident.type);
        
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [incident.longitude, incident.latitude]
          },
          properties: {
            title: incident.title,
            description: incident.description,
            originalType: incident.type,
            type: normalizedType
          }
        };
      })
    });
  }, [incidents]);

  // Show appropriate error message based on error type
  if (webGLLimitReached) {
    // For WebGL context limit, show a simplified placeholder that's less distracting
    return (
      <div className="w-full h-[300px] rounded-lg bg-gray-50 border border-gray-200 flex flex-col items-center justify-center p-2">
        <p className="text-sm text-gray-500 text-center italic">
          This region has {incidents.length} incident{incidents.length > 1 ? 's' : ''}.
          <br/>
          Please view earlier maps for details.
        </p>
      </div>
    );
  } else if (mapError) {
    // For other errors
    return (
      <div className="w-full h-[300px] rounded-lg bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Unable to load map. Please refresh to try again.</p>
      </div>
    );
  }

  // Special handling for Safari browser
  if (isSafari && incidents.length > 20) {
    return (
      <div className="w-full h-[300px] rounded-lg bg-gray-100 flex flex-col items-center justify-center p-4">
        <p className="text-gray-700 font-medium mb-2">Map view limited in Safari</p>
        <p className="text-gray-500 text-sm text-center">
          There are {incidents.length} incidents to display, which exceeds Safari's WebGL limits.
          For full map functionality, please use Chrome or Firefox, or view incidents by region.
        </p>
      </div>
    );
  }
  
  // Display a special error message for very large datasets in any browser
  if (incidents.length > 50) {
    return (
      <div className="w-full h-[300px] rounded-lg bg-gray-100 flex flex-col items-center justify-center p-4">
        <p className="text-gray-700 font-medium mb-2">Large number of incidents detected</p>
        <p className="text-gray-500 text-sm text-center">
          There are {incidents.length} incidents to display, which may exceed browser capacity.
          Please view incidents by region instead for optimal performance.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div 
        ref={mapContainer} 
        className="w-full h-[300px] rounded-lg"
        style={{ border: '1px solid #e5e7eb' }}
      />
      
      {mapWarning && !mapError && (
        <div className="absolute bottom-2 right-2 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-xs text-yellow-700">
          Map may display with limited features
        </div>
      )}
    </div>
  );
};

export default MaritimeMap;