import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapInstance, mountMap, updateMap, unmountMap } from '../../utils/map-manager';

/**
 * Shared Map component that reuses map instances by region
 * This helps avoid hitting WebGL context limits in browsers
 * 
 * @component
 * @param {Object} props
 * @param {string} props.mapId - ID for the map to use/create
 * @param {Array} props.incidents - Array of incidents to display
 * @param {Array} props.center - Center coordinates [lng, lat]
 * @param {number} props.zoom - Zoom level
 * @param {boolean} props.useClustering - Whether to enable clustering
 * @param {string} props.className - CSS class name for the container
 * @param {Object} props.style - Inline CSS styles for the container
 */
const SharedMap = ({ 
  mapId, 
  incidents = [], 
  center = [0, 0], 
  zoom = 1, 
  useClustering = false,
  className = "w-full h-[300px] rounded-lg",
  style = { border: '1px solid #e5e7eb' }
}) => {
  const mapContainer = useRef(null);
  const [error, setError] = useState(false);
  
  // Get MapBox token from environment
  const token = import.meta?.env?.VITE_MAPBOX_TOKEN;
  
  // Mount map on first render
  useEffect(() => {
    if (!mapContainer.current) return;
    if (!token) {
      console.error('MapBox token not found in environment variables');
      setError(true);
      return;
    }
    
    // Check if we already have this map instance
    let mapInfo = getMapInstance(mapId);
    
    // If it's not created yet, mount a new one
    if (!mapInfo) {
      mapInfo = mountMap(mapId, mapContainer.current, mapboxgl, { 
        accessToken: token,
        center, 
        zoom,
        mapboxgl
      });
      
      if (!mapInfo) {
        setError(true);
        return;
      }
    } else {
      // If it exists but in a different container, handle the transition
      try {
        const oldContainer = mapInfo.map.getContainer();
        const parent = oldContainer.parentNode;
        
        if (parent) {
          // Temporarily hide the map to avoid flicker
          oldContainer.style.display = 'none';
          
          // Remember the old dimensions
          const width = oldContainer.clientWidth;
          const height = oldContainer.clientHeight;
          
          // Remove from old container
          parent.removeChild(oldContainer);
          
          // Add to new container
          mapContainer.current.appendChild(oldContainer);
          
          // Restore visibility and resize
          oldContainer.style.display = 'block';
          oldContainer.style.width = '100%';
          oldContainer.style.height = '100%';
          
          // Force a resize to fit the new container
          mapInfo.map.resize();
        }
      } catch (e) {
        console.error('Error moving map:', e);
        setError(true);
      }
    }
    
    // Set up the map data once loaded
    const checkAndUpdateMap = () => {
      // Get current map info (might have changed)
      const currentMapInfo = getMapInstance(mapId);
      
      if (currentMapInfo && currentMapInfo.loaded) {
        updateMap(mapId, incidents, { 
          center, 
          zoom, 
          useClustering,
          mapboxgl 
        });
      } else {
        // Not loaded yet, check again soon
        setTimeout(checkAndUpdateMap, 100);
      }
    };
    
    checkAndUpdateMap();
    
    // Clean up function
    return () => {
      // Don't unmount the map, it might be reused elsewhere
    };
  }, [mapId, token]);
  
  // Update map data when incidents or view options change
  useEffect(() => {
    // Only try to update if map should be loaded
    const mapInfo = getMapInstance(mapId);
    if (mapInfo && mapInfo.loaded) {
      updateMap(mapId, incidents, { center, zoom, useClustering, mapboxgl });
    }
  }, [mapId, incidents, center, zoom, useClustering]);
  
  // Show error if map fails to load
  if (error) {
    return (
      <div className="w-full h-[300px] rounded-lg bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Unable to load map. Please refresh to try again.</p>
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