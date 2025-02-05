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

  useLayoutEffect(() => {
    if (mapInstance.current) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.error('MapBox token not found');
      setMapError(true);
      return;
    }

    try {
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mara-admin/clsbsqqvb011f01qqfwo95y4q',
        center: center,
        zoom: zoom,
        preserveDrawingBuffer: true,
        trackResize: true,
        attributionControl: false,
        navigationControl: false
      });

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
        ['robbery', 'attack', 'military'].forEach(type => {
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
        map.on('click', ['incidents-robbery', 'incidents-attack', 'incidents-military'], (e) => {
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
    </div>
  );
};

export default MaritimeMap;