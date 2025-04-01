import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapStyles.css';

/**
 * Interactive map component for displaying maritime incidents
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array<Object>} [props.incidents=[]] - Array of incident objects to display on the map
 * @param {Array<number>} [props.center=[103.8, 1.12]] - Initial map center coordinates [longitude, latitude]
 * @param {number} [props.zoom=8] - Initial zoom level
 * @returns {JSX.Element} Rendered map component
 */
const MaritimeMap = ({ 
  incidents = [], 
  center = [103.8, 1.12],
  zoom = 8
}) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const [mapError, setMapError] = useState(false);
  const [mapWarning, setMapWarning] = useState(false);

  useLayoutEffect(() => {
    // Always clean up the previous map instance before creating a new one
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
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
      // This captures and customizes how v2 tile loading errors are reported
      const originalConsoleError = console.error;
      console.error = function(...args) {
        // Filter out the errors related to MapBox resource loading
        if (args[0] && 
            (typeof args[0] === 'string' && args[0].includes('Failed to load resource')) ||
            (args[0] instanceof Error && args[0].message && args[0].message.includes('v2'))) {
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
      
      // Create map with resource timeout settings and telemetry disabled
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: customStyle,
        center: center,
        zoom: zoom,
        preserveDrawingBuffer: true,
        trackResize: true,
        attributionControl: false,
        navigationControl: false,
        failIfMajorPerformanceCaveat: false, // More permissive rendering
        localIdeographFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif", // Font fallbacks
        maxZoom: 18,
        refreshExpiredTiles: false, // Prevent unnecessary resource requests
        trackResize: true,
        collectResourceTiming: false, // Disable performance data collection
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
        attributionControl: false
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

        // Add pulsing dot image
        const size = 200;
        /**
         * Creates a pulsing dot animation for incident markers
         * 
         * @param {string} color - The RGB color string (format: "R,G,B")
         * @returns {Object} A mapbox custom image object with animation
         * @private
         */
        const pulsingDotForType = (color) => ({
          width: size,
          height: size,
          data: new Uint8Array(size * size * 4),
          onAdd: function() {
            const canvas = document.createElement('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            this.context = canvas.getContext('2d');
          },
          render: function() {
            const duration = 1000;
            const t = (performance.now() % duration) / duration;
            const radius = (size / 2) * 0.3;
            const outerRadius = (size / 2) * 0.7 * t + radius;
            const context = this.context;

            // Clear canvas
            context.clearRect(0, 0, this.width, this.height);

            // Draw outer circle
            context.beginPath();
            context.arc(
              this.width / 2,
              this.height / 2,
              outerRadius,
              0,
              Math.PI * 2
            );
            context.fillStyle = `rgba(${color}, ${1 - t})`;
            context.fill();

            // Draw inner circle
            context.beginPath();
            context.arc(
              this.width / 2,
              this.height / 2,
              radius,
              0,
              Math.PI * 2
            );
            context.fillStyle = `rgba(${color}, 1)`;
            context.strokeStyle = 'white';
            context.lineWidth = 2 + 4 * (1 - t);
            context.fill();
            context.stroke();

            // Update this image's data with data from the canvas
            this.data = context.getImageData(0, 0, this.width, this.height).data;

            // Continuously render until we don't
            map.triggerRepaint();
            return true;
          }
        });

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
        
        // Add pulsing dot image for each category
        Object.entries(typeColors).forEach(([type, color]) => {
          map.addImage(`pulsing-dot-${type}`, pulsingDotForType(color), { pixelRatio: 2 });
        });

        // Add source and layer for incidents with normalized types
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
          }
        });

        // Add layers for each incident category
        Object.keys(typeColors).forEach(type => {
          map.addLayer({
            id: `incidents-${type}`,
            type: 'symbol',
            source: 'incidents',
            filter: ['==', 'type', type],
            layout: {
              'icon-image': `pulsing-dot-${type}`,
              'icon-allow-overlap': true
            }
          });
        });

        // List of all layer IDs for event handling
        const allLayerIds = Object.keys(typeColors).map(type => `incidents-${type}`);
        
        // Add popups on click for all incident types
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

      mapInstance.current = map;

      map.on('error', (e) => {
        console.error('Map error:', e);
        setMapError(true);
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError(true);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
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

  if (mapError) {
    return (
      <div className="w-full h-[300px] rounded-lg bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Unable to load map. Please check console for errors.</p>
      </div>
    );
  }

  // Display a special error message for large datasets
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