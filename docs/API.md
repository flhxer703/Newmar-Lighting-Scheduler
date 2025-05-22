# RV Lighting System API Documentation

## Table of Contents

- [Overview](#overview)
- [RVLightingController Class](#rvlightingcontroller-class)
- [Methods Reference](#methods-reference)
- [Data Structures](#data-structures)
- [Events](#events)
- [Error Handling](#error-handling)
- [WebSocket Protocol](#websocket-protocol)
- [Examples](#examples)

## Overview

The RV Lighting System API provides a comprehensive interface for controlling RV lighting systems, managing scenes, and scheduling automated lighting events. The API is built around the `RVLightingController` class and integrates with SilverLeaf Electronics / Newmar RV control systems via WebSocket communication.

### Dependencies

- **WebSocket Connection**: `sendWSData(command)` function must be available
- **Parser Utilities**: `parserUtils` object with event packing functions
- **jQuery** (optional): For enhanced event handling
- **Modern Browser**: ES6+ support required

## RVLightingController Class

### Constructor

```javascript
const controller = new RVLightingController();
```

Creates a new lighting controller instance with the following properties:

- `lights`: Map of discovered light objects
- `scenes`: Map of saved lighting scenes
- `schedules`: Map of lighting schedules
- `isInitialized`: Boolean indicating initialization status
- `debug`: Boolean for debug logging

### Initialization

```javascript
await controller.initialize();
```

Discovers all available lights and initializes the system. Must be called before using other methods.

## Methods Reference

### Core Methods

#### `initialize()` → `Promise<Map>`

Discovers all available lights in the RV system.

```javascript
try {
    const lights = await controller.initialize();
    console.log(`Found ${lights.size} lights`);
} catch (error) {
    console.error('Initialization failed:', error);
}
```

**Returns**: Promise resolving to Map of discovered lights
**Throws**: `Error` with code `INIT_TIMEOUT` if discovery fails

#### `getAllLights()` → `Array`

Returns all discovered lights.

```javascript
const lights = controller.getAllLights();
lights.forEach(light => {
    console.log(`${light.name}: ${light.currentBrightness}%`);
});
```

**Returns**: Array of light objects

#### `getLightsByRoom(roomId)` → `Array`

Returns lights for a specific room.

```javascript
const livingRoomLights = controller.getLightsByRoom(0);
```

**Parameters**:
- `roomId` (number): Room ID (0-5)

**Returns**: Array of light objects in the specified room

### Light Control Methods

#### `setLightBrightness(lightIndex, brightness)` → `boolean`

Sets brightness for a specific light.

```javascript
// Set living room main light to 75%
const success = controller.setLightBrightness(1, 75);
```

**Parameters**:
- `lightIndex` (number): Light index from discovery
- `brightness` (number): Brightness level 0-100

**Returns**: Boolean indicating success

#### `toggleLight(lightIndex, state)` → `boolean`

Toggles a light on/off or sets to specific state.

```javascript
// Toggle light
controller.toggleLight(1);

// Set specific state
controller.toggleLight(1, true);  // Turn on
controller.toggleLight(1, false); // Turn off
```

**Parameters**:
- `lightIndex` (number): Light index
- `state` (boolean|null): Desired state, null to toggle

**Returns**: Boolean indicating success

#### `allLightsOn()` → `void`

Turns all lights on at 100% brightness.

```javascript
controller.allLightsOn();
```

#### `allLightsOff()` → `void`

Turns all lights off.

```javascript
controller.allLightsOff();
```

### Scene Management Methods

#### `saveScene(sceneName, roomFilter)` → `Promise<boolean>`

Saves current light states as a scene.

```javascript
// Save all lights
await controller.saveScene("Evening Relaxation");

// Save only living room lights
await controller.saveScene("Living Room Evening", 0);
```

**Parameters**:
- `sceneName` (string): Name for the scene
- `roomFilter` (number|null): Room ID to filter by, null for all rooms

**Returns**: Promise resolving to success status

#### `loadScene(sceneName)` → `boolean`

Loads and activates a saved scene.

```javascript
const success = controller.loadScene("Evening Relaxation");
```

**Parameters**:
- `sceneName` (string): Name of scene to load

**Returns**: Boolean indicating success

#### `deleteScene(sceneName)` → `boolean`

Deletes a saved scene.

```javascript
const success = controller.deleteScene("Old Scene");
```

**Parameters**:
- `sceneName` (string): Name of scene to delete

**Returns**: Boolean indicating success

#### `getAllScenes()` → `Array`

Returns all saved scenes.

```javascript
const scenes = controller.getAllScenes();
scenes.forEach(scene => {
    console.log(`Scene: ${scene.name}, Lights: ${scene.lights.length}`);
});
```

**Returns**: Array of scene objects

### Schedule Management Methods

#### `createSchedule(scheduleName, events)` → `boolean`

Creates a new lighting schedule.

```javascript
const events = [
    {
        time: "07:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
        action: "load_scene",
        scene: "Morning Bright"
    },
    {
        time: "22:00",
        days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
        action: "lights_off"
    }
];

const success = controller.createSchedule("Daily Routine", events);
```

**Parameters**:
- `scheduleName` (string): Name for the schedule
- `events` (Array): Array of schedule event objects

**Returns**: Boolean indicating success

#### `activateSchedule(scheduleName)` → `boolean`

Activates a schedule for automatic execution.

```javascript
const success = controller.activateSchedule("Daily Routine");
```

**Parameters**:
- `scheduleName` (string): Name of schedule to activate

**Returns**: Boolean indicating success

#### `deactivateSchedule(scheduleName)` → `boolean`

Deactivates a schedule.

```javascript
const success = controller.deactivateSchedule("Daily Routine");
```

**Parameters**:
- `scheduleName` (string): Name of schedule to deactivate

**Returns**: Boolean indicating success

### Data Management Methods

#### `exportConfig()` → `Object`

Exports all scenes and schedules as a configuration object.

```javascript
const config = controller.exportConfig();
console.log(JSON.stringify(config, null, 2));
```

**Returns**: Configuration object with scenes, schedules, and metadata

#### `importConfig(config)` → `boolean`

Imports scenes and schedules from a configuration object.

```javascript
const success = controller.importConfig(configData);
```

**Parameters**:
- `config` (Object): Configuration object to import

**Returns**: Boolean indicating success

#### `getStatus()` → `Object`

Returns current system status.

```javascript
const status = controller.getStatus();
console.log(`Lights: ${status.lightsCount}, Scenes: ${status.scenesCount}`);
```

**Returns**: System status object

### Utility Methods

#### `setDebug(enabled)` → `void`

Enables or disables debug logging.

```javascript
controller.setDebug(true);
```

**Parameters**:
- `enabled` (boolean): Whether to enable debug logging

#### `cleanup()` → `void`

Cleans up event handlers and intervals. Call before destroying the instance.

```javascript
controller.cleanup();
```

## Data Structures

### Light Object

```javascript
{
    name: "Living Room Main",          // Display name
    index: 1,                          // Unique index
    instance: 1,                       // RV system instance
    command: 0,                        // 0 = dimmer, other = switch
    room: 0,                           // Room ID (0-5)
    roomName: "Living Room",           // Room display name
    isDimmer: true,                    // Whether light supports dimming
    currentBrightness: 75              // Current brightness (0-100)
}
```

### Scene Object

```javascript
{
    name: "Evening Relaxation",        // Scene name
    created: "2024-05-22T20:00:00Z",   // ISO timestamp
    room: null,                        // Room filter (null = all rooms)
    lights: [                          // Array of light states
        {
            index: 1,                  // Light index
            name: "Living Room Main",  // Light name
            brightness: 75,            // Saved brightness
            room: 0                    // Light room
        }
    ]
}
```

### Schedule Object

```javascript
{
    name: "Daily Routine",             // Schedule name
    enabled: true,                     // Whether schedule is enabled
    created: "2024-05-22T20:00:00Z",   // ISO timestamp
    events: [                          // Array of scheduled events
        {
            time: "07:00",             // Time in HH:MM format
            days: ["mon", "tue"],      // Days of week
            action: "load_scene",      // Action type
            scene: "Morning Bright"    // Scene name (for load_scene)
        }
    ]
}
```

### System Status Object

```javascript
{
    initialized: true,                 // Initialization status
    lightsCount: 12,                   // Number of discovered lights
    scenesCount: 5,                    // Number of saved scenes
    schedulesCount: 2,                 // Number of schedules
    activeSchedulesCount: 1,           // Number of active schedules
    rooms: [                           // Room information
        {
            id: 0,                     // Room ID
            name: "Living Room",       // Room name
            lightCount: 3              // Lights in room
        }
    ]
}
```

## Events

### Custom Events

The system dispatches custom events for WebSocket message handling:

```javascript
// Light count received
document.body.addEventListener('GET_LIGHT_COUNT', (e) => {
    console.log('Light count:', e.detail);
});

// Light object received
document.body.addEventListener('GET_LIGHT_OBJECT[0]', (e) => {
    const lightData = JSON.parse(e.detail);
    console.log('Light object:', lightData);
});

// Brightness response
document.body.addEventListener('NEWMAR_DIMMER_BRIGHTNESS[1]', (e) => {
    console.log('Light 1 brightness:', e.detail);
});
```

## Error Handling

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INIT_TIMEOUT` | Light discovery timeout | Check WebSocket connection |
| `LIGHT_NOT_FOUND` | Invalid light index | Verify light exists |
| `SCENE_NOT_FOUND` | Scene doesn't exist | Check scene name |
| `COMMAND_FAILED` | WebSocket command failed | Check connection |

### Error Handling Pattern

```javascript
try {
    await controller.initialize();
    const success = controller.setLightBrightness(1, 75);
    if (!success) {
        console.error('Failed to set brightness');
    }
} catch (error) {
    switch (error.message) {
        case 'INIT_TIMEOUT':
            console.error('Connection timeout - check WebSocket');
            break;
        default:
            console.error('Unexpected error:', error);
    }
}
```

## WebSocket Protocol

### Message Formats

#### Outgoing Messages

```javascript
// Light discovery
"GET_LIGHT_COUNT"
"GET_LIGHT_OBJECT[0]"

// Light control
"HMSEVENT=ENEWMARDIMMERPARSER_SET_BRIGHTNESS_NONSCALED|0x0164"
"HMSEVENT=ENEWMARDIMMERPARSER_TURN_ON_OFF|0x0101"

// Status request
"NEWMAR_DIMMER_BRIGHTNESS[1]"

// System
"?*!"  // Initialization
"ping" // Keep-alive
"PIN=1234" // Authentication
```

#### Incoming Messages

```javascript
// Authentication
"SHOWPIN" / "SHOWPINPAIR"
"CORRECTPIN" / "INCORRECTPIN"
"LOCKEDPIN"

// Data responses
"GET_LIGHT_COUNT=5"
"GET_LIGHT_OBJECT[0]={\"name\":\"Living Room\",\"index\":1,...}"
"NEWMAR_DIMMER_BRIGHTNESS[1]=75%"
```

### Event Packing

Commands use packed event format:

```javascript
// Brightness command
const packed = parserUtils.packEvent(
    parserUtils.ESET_INSTANCE(lightIndex),
    parserUtils.ESET_BRIGHTNESS(scaledBrightness)
);

// On/Off command
const packed = parserUtils.packEvent(
    parserUtils.ESET_INSTANCE(lightIndex),
    parserUtils.ESET_LEVEL(level)
);
```

### Room Constants

```javascript
const ROOMS = {
    LIVING_ROOM: 0,
    KITCHEN: 1,
    BEDROOM: 2,
    BATH: 3,
    HALF_BATH: 4,
    EXTERIOR: 5
};
```

## Examples

### Basic Setup

```javascript
// Initialize the lighting system
const controller = new RVLightingController();

// Enable debug logging
controller.setDebug(true);

// Initialize and discover lights
try {
    const lights = await controller.initialize();
    console.log(`Successfully discovered ${lights.size} lights`);
    
    // List all lights
    controller.getAllLights().forEach(light => {
        console.log(`${light.name} (Room: ${light.roomName})`);
    });
} catch (error) {
    console.error('Failed to initialize:', error);
}
```

### Light Control

```javascript
// Set individual light brightness
controller.setLightBrightness(1, 50);  // 50%
controller.setLightBrightness(2, 100); // 100%

// Toggle lights
controller.toggleLight(3);              // Toggle current state
controller.toggleLight(4, true);        // Force on
controller.toggleLight(5, false);       // Force off

// Control all lights
controller.allLightsOn();               // All lights to 100%
controller.allLightsOff();              // All lights off

// Get lights by room
const kitchenLights = controller.getLightsByRoom(1);
kitchenLights.forEach(light => {
    controller.setLightBrightness(light.index, 75);
});
```

### Scene Management

```javascript
// Save current state as scene
await controller.saveScene("Movie Night");

// Save only bedroom lights
await controller.saveScene("Bedroom Evening", 2);

// Load a scene
controller.loadScene("Movie Night");

// List all scenes
controller.getAllScenes().forEach(scene => {
    console.log(`${scene.name}: ${scene.lights.length} lights`);
});

// Delete a scene
controller.deleteScene("Old Scene");
```

### Schedule Management

```javascript
// Create a comprehensive daily schedule
const workdaySchedule = [
    {
        time: "06:30",
        days: ["mon", "tue", "wed", "thu", "fri"],
        action: "load_scene",
        scene: "Morning Routine"
    },
    {
        time: "08:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
        action: "lights_off"
    },
    {
        time: "18:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
        action: "load_scene",
        scene: "Evening Welcome"
    },
    {
        time: "22:00",
        days: ["sun", "mon", "tue", "wed", "thu"],
        action: "load_scene",
        scene: "Night Mode"
    },
    {
        time: "23:30",
        days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
        action: "lights_off"
    }
];

// Create and activate schedule
controller.createSchedule("Workday Routine", workdaySchedule);
controller.activateSchedule("Workday Routine");

// Weekend schedule
const weekendSchedule = [
    {
        time: "09:00",
        days: ["sat", "sun"],
        action: "load_scene",
        scene: "Lazy Morning"
    },
    {
        time: "20:00",
        days: ["fri", "sat"],
        action: "load_scene",
        scene: "Party Mode"
    }
];

controller.createSchedule("Weekend Fun", weekendSchedule);
controller.activateSchedule("Weekend Fun");
```

### Data Import/Export

```javascript
// Export configuration
const config = controller.exportConfig();

// Save to file (browser environment)
const dataStr = JSON.stringify(config, null, 2);
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);

const link = document.createElement('a');
link.href = url;
link.download = 'rv-lighting-config.json';
link.click();

// Import configuration
const success = controller.importConfig(configData);
if (success) {
    console.log('Configuration imported successfully');
} else {
    console.error('Failed to import configuration');
}
```

### Advanced Usage

```javascript
// Custom scene creation with specific lights
const customScene = {
    name: "Reading Time",
    created: new Date().toISOString(),
    room: null,
    lights: [
        { index: 1, name: "Living Room Main", brightness: 30, room: 0 },
        { index: 4, name: "Reading Lamp", brightness: 90, room: 0 },
        { index: 8, name: "Kitchen Under Cabinet", brightness: 20, room: 1 }
    ]
};

// Manually add scene
controller.scenes.set(customScene.name, customScene);
controller.saveToStorage();

// Monitor system status
setInterval(() => {
    const status = controller.getStatus();
    console.log(`System Status: ${status.lightsCount} lights, ${status.activeSchedulesCount} active schedules`);
}, 60000);

// Error handling with retry
async function robustLightControl(lightIndex, brightness, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const success = controller.setLightBrightness(lightIndex, brightness);
            if (success) return true;
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed:`, error);
        }
    }
    
    console.error(`Failed to control light ${lightIndex} after ${maxRetries} attempts`);
    return false;
}
```

### Integration with WebSocket Events

```javascript
// Listen for specific light updates
document.body.addEventListener('NEWMAR_DIMMER_BRIGHTNESS[1]', (e) => {
    const brightness = parseInt(e.detail.replace('%', ''));
    console.log(`Light 1 brightness updated: ${brightness}%`);
    
    // Update UI or trigger other actions
    updateLightDisplay(1, brightness);
});

// Custom event handling
class RVLightingExtension extends RVLightingController {
    constructor() {
        super();
        this.setupCustomEvents();
    }
    
    setupCustomEvents() {
        // Override or extend existing functionality
        this.addEventListener('light_changed', (lightIndex, brightness) => {
            console.log(`Light ${lightIndex} changed to ${brightness}%`);
            this.onLightChanged(lightIndex, brightness);
        });
    }
    
    onLightChanged(lightIndex, brightness) {
        // Custom logic for light changes
        const light = this.lights.get(lightIndex);
        if (light && light.room === 0 && brightness === 0) {
            // If living room light turned off, dim others
            this.getLightsByRoom(0).forEach(roomLight => {
                if (roomLight.index !== lightIndex && roomLight.currentBrightness > 50) {
                    this.setLightBrightness(roomLight.index, 30);
                }
            });
        }
    }
}
```

### Testing and Debugging

```javascript
// Enable comprehensive debugging
window.RV_LIGHTING_DEBUG = true;
controller.setDebug(true);

// Test all lights
async function testAllLights() {
    const lights = controller.getAllLights();
    
    for (const light of lights) {
        console.log(`Testing light: ${light.name}`);
        
        // Test brightness levels
        for (const brightness of [0, 25, 50, 75, 100]) {
            controller.setLightBrightness(light.index, brightness);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Return to off
        controller.setLightBrightness(light.index, 0);
    }
}

// Validate scene integrity
function validateScenes() {
    controller.getAllScenes().forEach(scene => {
        scene.lights.forEach(lightState => {
            const light = controller.lights.get(lightState.index);
            if (!light) {
                console.warn(`Scene "${scene.name}" references missing light ${lightState.index}`);
            }
        });
    });
}

// Performance monitoring
const performanceTimer = {
    start: Date.now(),
    log: (operation) => {
        const elapsed = Date.now() - performanceTimer.start;
        console.log(`${operation} took ${elapsed}ms`);
        performanceTimer.start = Date.now();
    }
};

performanceTimer.start = Date.now();
await controller.initialize();
performanceTimer.log('Initialization');

controller.saveScene("Test Scene");
performanceTimer.log('Scene Save');

controller.loadScene("Test Scene");
performanceTimer.log('Scene Load');
```

## Browser Compatibility

### Minimum Requirements

- **ES6+ Support**: Classes, async/await, Map, Set
- **WebSocket API**: Native WebSocket support
- **Local Storage**: For data persistence
- **Custom Events**: For message handling

### Supported Browsers

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

### Polyfills

For older browsers, include polyfills for:

```html
<!-- Promise polyfill for IE -->
<script src="https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.auto.min.js"></script>

<!-- Fetch polyfill for older browsers -->
<script src="https://cdn.jsdelivr.net/npm/whatwg-fetch@3/fetch.js"></script>
```

## Performance Considerations

### Memory Usage

- Light objects: ~200 bytes each
- Scene objects: ~1KB per scene (varies by light count)
- Schedule objects: ~500 bytes each
- Total memory usage typically < 1MB for large RV systems

### Network Traffic

- Initial discovery: 1-20 messages depending on light count
- Light control: 1 message per command
- Status requests: 1 message per light
- Keep-alive: 1 message every 30 seconds

### Optimization Tips

```javascript
// Batch operations for better performance
const batchLightControl = (lightSettings) => {
    const promises = lightSettings.map(({ index, brightness }) => 
        controller.setLightBrightness(index, brightness)
    );
    return Promise.all(promises);
};

// Debounce rapid UI changes
const debouncedSave = debounce(() => {
    controller.saveToStorage();
}, 1000);

// Cache frequently used data
const roomLightCache = new Map();
const getRoomLights = (roomId) => {
    if (!roomLightCache.has(roomId)) {
        roomLightCache.set(roomId, controller.getLightsByRoom(roomId));
    }
    return roomLightCache.get(roomId);
};
```