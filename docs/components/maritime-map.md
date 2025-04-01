# Maritime Map Component

## Overview

The Maritime Map component provides an interactive geospatial visualization for maritime incidents and security data. It's a core shared component used across different applications in the MARA system.

## Functionality

The Maritime Map offers:
- Interactive map visualization powered by Mapbox GL JS
- Geographic plotting of maritime incidents
- Customizable markers for different incident types
- Regional focus capabilities for specific areas of interest
- Zoom and pan controls for navigation
- Popup information on incident selection
- Time-based filtering for historical and current data

## Implementation Details

### Component Location

The component is located at `/src/shared/components/MaritimeMap/index.jsx` and is used across different applications for visualizing maritime security data.

### Technical Approach

The map implementation:
1. Uses Mapbox GL JS for high-performance mapping
2. Implements custom animated pulsing dot markers for different incident types
3. Uses GeoJSON for efficient data representation
4. Provides interaction handlers for user events
5. Supports responsive design principles for different screen sizes
6. Limits WebGL context usage to prevent browser limitations (especially in Safari)
7. Implements marker clustering for areas with many incidents

### Browser Considerations

The component manages WebGL context limitations:
1. Automatically detects browser type (Safari, Chrome, Firefox)
2. Sets appropriate WebGL context limits based on browser capabilities
3. Provides a fallback display for scenarios where WebGL context limits are exceeded
4. Uses a global counter to track active map instances across the application

## Usage

To use the Maritime Map in a component:

```jsx
import MaritimeMap from '@mara/shared/components/MaritimeMap';

function IncidentMap() {
  const incidents = [
    {
      id: 'inc-1234',
      type: 'piracy_attempt',
      coordinates: [3.2345, 6.5432],
      title: 'Attempted boarding of cargo vessel',
      date: '2023-09-15T08:30:00Z',
      severity: 'medium'
    },
    // More incidents...
  ];

  return (
    <div style={{ height: '500px', width: '100%' }}>
      <MaritimeMap 
        incidents={incidents}
        center={[0, 0]}
        zoom={2}
        onIncidentClick={(incident) => console.log('Clicked:', incident)}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| incidents | array | Array of incident objects with coordinates and metadata |
| center | array | [longitude, latitude] for the initial center of the map |
| zoom | number | Initial zoom level (1-22, where 1 is zoomed all the way out) |
| onIncidentClick | function | Callback function when an incident is clicked |
| height | string | Optional CSS height value (defaults to '100%') |
| width | string | Optional CSS width value (defaults to '100%') |
| showControls | boolean | Whether to show zoom/navigation controls (defaults to true) |
| darkMode | boolean | Whether to use dark mode styling (defaults to false) |

## Dependencies

- Mapbox GL JS: For the mapping capabilities
- React: For component lifecycle and state management
- custom-icon-loader: Internal utility for loading custom marker icons

## When to Use MaritimeMap vs. StaticMap

The MARA system provides two map components to address different use cases:

- **MaritimeMap**: Use for primary interactive maps where user interaction is important and WebGL context usage is managed carefully. Best for executive briefs, regional overviews, and interactive features.

- **StaticMap**: Use for secondary map displays where showing location is sufficient and reducing WebGL context usage is critical. Best for incident details pages in weekly reports and other pages with many map instances.

### Integration with IncidentDetails

The `IncidentDetails` component accepts a `useInteractiveMap` prop that toggles between the two map types:

```jsx
// Use interactive map (MaritimeMap) for Flash Reports
<IncidentDetails incident={data} useInteractiveMap={true} />

// Use static map (StaticMap) for Weekly Reports to avoid WebGL context limits
<IncidentDetails incident={data} useInteractiveMap={false} />
```

## Future Improvements

Potential enhancements:

1. Add heatmap visualization for incident density
2. Add time-based animations for incident sequences
3. Support for drawing tools for custom regions
4. Enhanced filtering capabilities by incident attributes
5. Improved performance for large datasets
6. Further optimization of WebGL context usage