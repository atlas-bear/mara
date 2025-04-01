# Static Map Component

## Overview

The Static Map component provides a lightweight, non-WebGL alternative to the interactive MaritimeMap component. It displays location data without creating additional WebGL contexts, which helps avoid browser limitations when displaying multiple maps on a single page.

## Functionality

The Static Map component offers:
- Mapbox Static Images API integration for server-rendered maps
- Consistent visual styling with the interactive MaritimeMap component
- Small pins with danger Maki icons for incident markers
- Color-coded markers based on incident type
- Fallback mechanisms for error handling
- Zero WebGL context usage (important for browser performance)

## Implementation Details

### Component Location

The component is located at `/src/shared/components/StaticMap/index.jsx` and is primarily used in the Weekly Report for incident details.

### Technical Approach

The Static Map implementation:
1. Uses Mapbox Static Images API instead of WebGL-based maps
2. Implements custom marker styling with small pins and danger icons
3. Maintains consistent color scheme with the interactive map
4. Provides fallback mechanisms for failed map loads
5. Uses React hooks for state management and error handling
6. Properly escapes and encodes URLs for the Mapbox API

## Usage

To use the Static Map in a component:

```jsx
import StaticMap from '@shared/components/StaticMap';

function IncidentLocationDisplay() {
  const incidents = [
    {
      longitude: 3.2345,
      latitude: 6.5432,
      type: 'piracy',
      title: 'Attempted boarding of cargo vessel'
    },
    // More incidents...
  ];

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <StaticMap 
        incidents={incidents}
        center={[3.2345, 6.5432]}
        zoom={5}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| incidents | array | Array of incident objects with longitude, latitude, and type |
| center | array | [longitude, latitude] for the center of the map |
| zoom | number | Zoom level (1-22, where 1 is zoomed all the way out) |
| className | string | Optional CSS class name for the container (defaults to "w-full h-[300px] rounded-lg") |
| style | object | Optional inline styles to apply to the container |

## Dependencies

- Mapbox Static Images API: For generating static map images
- React: For component lifecycle and state management

## When to Use StaticMap

Use the StaticMap component when:
- You need to display multiple maps on a single page (e.g., in Weekly Reports)
- Browser WebGL context limits are a concern (especially in Safari)
- User interaction with the map is not essential
- Simple location display is sufficient

For primary interactive maps, use the MaritimeMap component instead.

## Integration with IncidentDetails

The StaticMap component is integrated with the IncidentDetails component which can toggle between static and interactive maps:

```jsx
// To use StaticMap (default behavior):
<IncidentDetails incident={data} useInteractiveMap={false} />
```