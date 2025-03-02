import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapStyles.css';

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
    if (mapInstance.current) return;

    // Get MapBox token from environment
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.error('MapBox token not found in environment variables');
      setMapError(true);
      return;
    }
    
    // For security, create a reference to the token rather than logging it
    console.log('MapBox token found:', token ? 'yes' : 'no');

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
      
      // Create map with resource timeout settings
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
        refreshExpiredTiles: false // Prevent unnecessary resource requests
      });
      
      // Add error handler specifically for style loading
      map.on('style.load', () => {
        console.log('Map style loaded successfully');
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
        console.log('Map loaded successfully');

        // Add pulsing dot image
        const size = 200;
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

        // Add pulsing dot images for each type
        map.addImage('pulsing-dot-robbery', pulsingDotForType('239,68,68'), { pixelRatio: 2 });
        map.addImage('pulsing-dot-attack', pulsingDotForType('249,115,22'), { pixelRatio: 2 });
        map.addImage('pulsing-dot-military', pulsingDotForType('59,130,246'), { pixelRatio: 2 });
        map.addImage('pulsing-dot-boarding', pulsingDotForType('239,68,68'), { pixelRatio: 2 });
        map.addImage('pulsing-dot-piracy', pulsingDotForType('249,115,22'), { pixelRatio: 2 });
        map.addImage('pulsing-dot-military-activity', pulsingDotForType('59,130,246'), { pixelRatio: 2 });
        map.addImage('pulsing-dot-robbery-theft', pulsingDotForType('59,130,246'), { pixelRatio: 2 });

        // Add source and layer for incidents
        map.addSource('incidents', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: incidents.map(incident => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [incident.longitude, incident.latitude]
              },
              properties: {
                title: incident.title,
                description: incident.description,
                type: incident.type
              }
            }))
          }
        });

        // Add layers for each incident type
        ['robbery', 'attack', 'military', 'piracy', 'robbery-theft', 'boarding', 'military-activity'].forEach(type => {
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

        // Add popups on click
        map.on('click', ['incidents-robbery', 'incidents-attack', 'incidents-military', 'incidents-piracy', 'incidents-boarding'], (e) => {
          const coordinates = e.features[0].geometry.coordinates.slice();
          const { title, description } = e.features[0].properties;

          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <h3 class="font-bold">${title}</h3>
              <p>${description}</p>
            `)
            .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', ['incidents-robbery', 'incidents-attack', 'incidents-military'], () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', ['incidents-robbery', 'incidents-attack', 'incidents-military'], () => {
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
  }, []);

  // Update markers when incidents change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.loaded() || !map.getSource('incidents')) return;

    map.getSource('incidents').setData({
      type: 'FeatureCollection',
      features: incidents.map(incident => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [incident.longitude, incident.latitude]
        },
        properties: {
          title: incident.title,
          description: incident.description,
          type: incident.type
        }
      }))
    });
  }, [incidents]);

  if (mapError) {
    return (
      <div className="w-full h-[300px] rounded-lg bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Unable to load map. Please check console for errors.</p>
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