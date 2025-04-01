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
  
  // Get MapBox token from environment using Vite's import.meta.env
  // This is the standard approach used throughout the codebase
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  
  // Mount map on first render
  useEffect(() => {
    console.log(`SharedMap init ${mapId}:`, { 
      hasContainer: !!mapContainer.current,
      hasToken: !!token,
      incidents: incidents.length
    });
    
    if (!mapContainer.current) return;
    if (!token) {
      console.error('MapBox token not found in environment variables');
      setError(true);
      return;
    }
    
    // Check if we already have this map instance
    let mapInfo = getMapInstance(mapId);
    
    // Set the token first before trying to mount
    mapboxgl.accessToken = token;

    // If it's not created yet, mount a new one
    if (!mapInfo) {
      mapInfo = mountMap(mapId, mapContainer.current, mapboxgl, { 
        center, 
        zoom
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
        
        // Log details for debugging
        console.log(`Moving map ${mapId} to new container:`, {
          hasParent: !!parent,
          oldSize: oldContainer ? { width: oldContainer.clientWidth, height: oldContainer.clientHeight } : null,
          newContainer: mapContainer.current ? mapContainer.current.className : 'unknown'
        });
        
        if (parent) {
          // Approach 1: Move the container
          try {
            // Temporarily hide the map to avoid flicker
            oldContainer.style.display = 'none';
            
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
          } catch (moveError) {
            console.error('Error moving map container, trying alternate approach:', moveError);
            
            // Approach 2: Create new map in new container
            try {
              // Remove old map
              mapInfo.map.remove();
              
              // Create new map in the new container
              mapInfo = mountMap(mapId, mapContainer.current, mapboxgl, { 
                center, 
                zoom
              });
            } catch (recreateError) {
              console.error('Error recreating map:', recreateError);
              setError(true);
            }
          }
        } else {
          // If no parent, try to reuse the map object with the new container
          try {
            mapInfo = mountMap(mapId, mapContainer.current, mapboxgl, { 
              center, 
              zoom
            });
          } catch (e) {
            console.error('Error creating new map:', e);
            setError(true);
          }
        }
      } catch (e) {
        console.error('Error handling map container:', e);
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
          useClustering 
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
    // Only try to update if map should be loaded and token is available
    if (!token) return;
    
    const mapInfo = getMapInstance(mapId);
    if (mapInfo && mapInfo.loaded) {
      updateMap(mapId, incidents, { center, zoom, useClustering });
    }
  }, [mapId, incidents, center, zoom, useClustering, token]);
  
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