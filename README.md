# RV Lighting Scenes & Schedules System

A comprehensive lighting control system for RVs with scene management and automated scheduling capabilities. Built specifically for integration with SilverLeaf Electronics / Newmar RV control systems.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Code Analysis](#code-analysis)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [File Structure](#file-structure)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

This project extends existing RV lighting control systems by adding scene management and automated scheduling capabilities. The system discovers existing lights through the RV's WebSocket communication protocol and provides both manual control and automated scheduling features.

### Key Capabilities

- **Scene Management**: Save and recall lighting configurations
- **Automated Schedules**: Time-based lighting automation with day-of-week support
- **Room Organization**: Controls grouped by room (Living Room, Kitchen, Bedroom, etc.)
- **Dimmer Support**: Full brightness control for compatible dimmer lights
- **Data Persistence**: Local storage of scenes and schedules
- **Import/Export**: Backup and restore configurations

## System Architecture

### Communication Protocol

The system communicates with the RV's control system via WebSocket using a specific command structure:

```
Protocol: ws://hostname:port/ or wss://hostname:port/
Authentication: PIN-based with session storage
Message Format: KEY=VALUE or HMSEVENT=COMMAND|PACKED_DATA
```

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   User Interface                        │
│  ┌─────────────┬─────────────┬─────────────┬──────────┐ │
│  │   Lights    │   Scenes    │  Schedules  │ Settings │ │
│  └─────────────┴─────────────┴─────────────┴──────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│              RVLightingController                       │
│  ┌─────────────────┬─────────────────┬────────────────┐ │
│  │ Scene Manager   │ Schedule Engine │ Light Manager  │ │
│  └─────────────────┴─────────────────┴────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│              WebSocket Communication                    │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  GET_LIGHT_COUNT → GET_LIGHT_OBJECT[n] → HMSEVENT   │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                RV Control System                        │
│           (SilverLeaf Electronics)                      │
└─────────────────────────────────────────────────────────┘
```

## Code Analysis

### Original WebSocket Client Analysis

#### File: `websocket-client.js`

**Purpose**: Core WebSocket communication handler for RV control system

**Key Components**:

1. **Connection Management**
   ```javascript
   var socket = webSocketType + "://" + window.location.hostname + ":"+ socketPort +"/";
   var client = new WebSocket(socket);
   ```

2. **Authentication System**
   - PIN-based authentication with session storage
   - Messages: `SHOWPIN`, `CORRECTPIN`, `INCORRECTPIN`, `LOCKEDPIN`

3. **Message Processing**
   - Format: `KEY=VALUE` for basic commands
   - RVC Messages: 16-character hex strings converted to 8-byte arrays
   - Event triggering via jQuery: `$('.'+iddata[0]).trigger("update", iddata[1])`

4. **System Commands**
   - `?*!` - System initialization
   - `ping` - Keep-alive mechanism
   - `LR_DATE_TIME=` - Time synchronization

#### File: `newmar-lighting.js`

**Purpose**: Newmar 2024 lighting system implementation

**Key Components**:

1. **Room Organization**
   ```javascript
   #define OPTIONCODE_ROOMLOC_LIVINGROOM    0
   #define OPTIONCODE_ROOMLOC_KITCHEN       1
   #define OPTIONCODE_ROOMLOC_BED           2
   #define OPTIONCODE_ROOMLOC_BATH          3
   #define OPTIONCODE_ROOMLOC_HALFBATH      4
   #define OPTIONCODE_ROOMLOC_EXTERIOR      5
   ```

2. **Light Discovery Protocol**
   ```javascript
   sendWSData("GET_LIGHT_COUNT");
   // Response triggers: GET_LIGHT_COUNT event
   
   sendWSData(`GET_LIGHT_OBJECT[${i}]`);
   // Response: JSON object with light properties
   ```

3. **Control Commands**
   ```javascript
   // On/Off Control
   HMSEVENT=ENEWMARDIMMERPARSER_TURN_ON_OFF|{packed_event}
   
   // Brightness Control  
   HMSEVENT=ENEWMARDIMMERPARSER_SET_BRIGHTNESS_NONSCALED|{packed_event}
   
   // Status Request
   NEWMAR_DIMMER_BRIGHTNESS[{index}]
   ```

4. **Event Packing System**
   ```javascript
   parserUtils.packEvent(
       parserUtils.ESET_INSTANCE(index),
       parserUtils.ESET_BRIGHTNESS(value)
   )
   ```

**Light Object Structure**:
```json
{
    "name": "Living Room Main",
    "index": 1,
    "instance": 1,
    "command": 0,
    "room_loc": 0
}
```

Where:
- `command`: 0 = dimmer, other = switch
- `room_loc`: Room location code (0-5)

## Features

### 🎭 Scene Management

- **Save Current State**: Capture all light settings as a named scene
- **Room Filtering**: Save scenes for specific rooms only
- **Quick Recall**: Instantly restore saved lighting configurations
- **Scene Library**: Manage multiple saved scenes with creation dates

### ⏰ Automated Schedules

- **Time-Based Events**: Schedule lighting changes at specific times
- **Day Selection**: Choose which days of the week schedules run
- **Multiple Actions**: 
  - Load specific scenes
  - Turn all lights on/off
  - Custom lighting patterns
- **Schedule Management**: Enable/disable schedules without deletion

### 💡 Manual Control

- **Individual Light Control**: Brightness sliders for dimmers, on/off for switches
- **Room Grouping**: Lights organized by room location
- **Quick Actions**: All lights on/off, save current scene
- **Real-time Updates**: Immediate feedback on light status changes

### 🔧 System Features

- **Auto-Discovery**: Automatically finds all available lights
- **Data Persistence**: Scenes and schedules saved to browser storage
- **Import/Export**: Backup and restore configurations
- **Status Monitoring**: System health and connection status
- **Error Handling**: Graceful handling of communication errors

## Installation

### Prerequisites

- RV with SilverLeaf Electronics control system
- Web browser with JavaScript enabled
- Access to RV's internal network
- Existing WebSocket communication setup

### Setup Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/rv-lighting-scenes.git
   cd rv-lighting-scenes
   ```

2. **Include Core Files**
   ```html
   <!-- Include the lighting controller -->
   <script src="src/RVLightingController.js"></script>
   
   <!-- Include the UI (optional) -->
   <link rel="stylesheet" href="src/lighting-ui.css">
   <script src="src/lighting-ui.js"></script>
   ```

3. **Initialize the System**
   ```javascript
   // Ensure WebSocket client is connected first
   const lightingController = new RVLightingController();
   
   lightingController.initialize().then(() => {
       console.log("Lighting system ready!");
   }).catch(error => {
       console.error("Failed to initialize:", error);
   });
   ```

### Integration with Existing Systems

The lighting controller integrates with existing WebSocket implementations:

```javascript
// Must have these functions available:
// - sendWSData(command)
// - parserUtils.packEvent()
// - parserUtils.ESET_INSTANCE()
// - parserUtils.ESET_BRIGHTNESS()
// - jQuery for event handling
```

## Usage

### Basic Scene Management

```javascript
// Initialize controller
const lightingController = new RVLightingController();
await lightingController.initialize();

// Save current lighting as a scene
await lightingController.saveScene("Evening Relaxation");

// Save only living room lights
await lightingController.saveScene("Living Room Evening", 0);

// Load a saved scene
lightingController.loadScene("Evening Relaxation");

// Get all scenes
const scenes = lightingController.getAllScenes();
console.log(scenes);
```

### Schedule Creation

```javascript
// Create a daily lighting schedule
lightingController.createSchedule("Daily Routine", [
    {
        time: "07:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
        action: "load_scene",
        scene: "Morning Bright"
    },
    {
        time: "20:00",
        days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
        action: "load_scene", 
        scene: "Evening Relaxation"
    },
    {
        time: "22:30",
        days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
        action: "lights_off"
    }
]);

// Activate the schedule
lightingController.activateSchedule("Daily Routine");

// Deactivate when not needed
lightingController.deactivateSchedule("Daily Routine");
```

### Manual Light Control

```javascript
// Set specific light brightness (0-100%)
lightingController.setLightBrightness(1, 75);

// Toggle light on/off
lightingController.toggleLight(1);

// Turn all lights off
lightingController.allLightsOff();

// Turn all lights on
lightingController.allLightsOn();

// Get lights by room
const livingRoomLights = lightingController.getLightsByRoom(0);
```

### Data Management

```javascript
// Export configuration
const config = lightingController.exportConfig();
console.log(JSON.stringify(config, null, 2));

// Import configuration
const success = lightingController.importConfig(configData);

// Get system status
const lights = lightingController.getAllLights();
console.log(`Found ${lights.length} lights`);
```

## API Reference

### RVLightingController Class

#### Constructor

```javascript
new RVLightingController()
```

Creates a new lighting controller instance.

#### Methods

##### `initialize()` → `Promise<Map>`

Discovers all available lights and initializes the system.

**Returns**: Promise that resolves to a Map of discovered lights.

##### `setLightBrightness(lightIndex, brightness)` → `boolean`

Sets brightness for a specific light.

**Parameters**:
- `lightIndex` (number): Light index from discovery
- `brightness` (number): Brightness level 0-100

**Returns**: Success status

##### `saveScene(sceneName, roomFilter)` → `Promise<boolean>`

Saves current light states as a scene.

**Parameters**:
- `sceneName` (string): Name for the scene
- `roomFilter` (number, optional): Room ID to filter by

**Returns**: Promise resolving to success status

##### `loadScene(sceneName)` → `boolean`

Loads and activates a saved scene.

**Parameters**:
- `sceneName` (string): Name of scene to load

**Returns**: Success status

##### `createSchedule(scheduleName, events)` → `boolean`

Creates a new lighting schedule.

**Parameters**:
- `scheduleName` (string): Name for the schedule
- `events` (Array): Array of schedule event objects

**Event Object Structure**:
```javascript
{
    time: "HH:MM",           // 24-hour format
    days: ["mon", "tue"],    // Array of day codes
    action: "load_scene",    // Action type
    scene: "scene_name"      // Scene name (if action is load_scene)
}
```

##### `activateSchedule(scheduleName)` → `boolean`

Activates a schedule for automatic execution.

##### `deactivateSchedule(scheduleName)` → `boolean`

Deactivates a schedule.

##### `getAllLights()` → `Array`

Returns array of all discovered lights.

##### `getLightsByRoom(roomId)` → `Array`

Returns lights for a specific room.

**Parameters**:
- `roomId` (number): Room ID (0-5)

##### `exportConfig()` → `Object`

Exports all scenes and schedules as JSON.

##### `importConfig(config)` → `boolean`

Imports scenes and schedules from configuration object.

### Room Constants

```javascript
const Rooms = {
    LIVING_ROOM: 0,
    KITCHEN: 1, 
    BEDROOM: 2,
    BATH: 3,
    HALF_BATH: 4,
    EXTERIOR: 5
};
```

### Light Object Structure

```javascript
{
    name: "Light Name",
    index: 1,
    instance: 1,
    command: 0,              // 0 = dimmer, other = switch
    room: 0,                 // Room ID
    roomName: "Living Room",
    isDimmer: true,
    currentBrightness: 75
}
```

### Scene Object Structure

```javascript
{
    name: "Scene Name",
    created: "2024-05-22T20:00:00Z",
    room: 0,                 // null for all rooms
    lights: [
        {
            index: 1,
            name: "Light Name",
            brightness: 75,
            room: 0
        }
    ]
}
```

### Schedule Object Structure

```javascript
{
    name: "Schedule Name",
    enabled: true,
    created: "2024-05-22T20:00:00Z",
    events: [
        {
            time: "07:00",
            days: ["mon", "tue", "wed", "thu", "fri"],
            scene: "Morning Bright",
            action: "load_scene"
        }
    ]
}
```

## File Structure

```
rv-lighting-scenes/
├── README.md
├── LICENSE
├── src/
│   ├── RVLightingController.js     # Core lighting controller class
│   ├── lighting-ui.html            # Complete UI implementation
│   ├── lighting-ui.css             # UI styling
│   └── lighting-ui.js              # UI JavaScript
├── docs/
│   ├── API.md                      # Detailed API documentation
│   ├── INTEGRATION.md              # Integration guide
│   └── TROUBLESHOOTING.md          # Common issues and solutions
├── examples/
│   ├── basic-usage.js              # Basic implementation examples
│   ├── advanced-schedules.js       # Advanced scheduling examples
│   └── custom-integration.js       # Custom integration examples
└── tests/
    ├── controller.test.js          # Unit tests for controller
    └── integration.test.js         # Integration tests
```

## Configuration

### WebSocket Settings

The system uses the existing WebSocket configuration:

```javascript
// Default port and protocol detection
socketPort = '8092';
let webSocketType = "ws";
if(window.location.protocol.indexOf("https") > -1)
    webSocketType = "wss";
```

### Storage Settings

Data is stored in browser localStorage:

```javascript
// Storage key
'rv_lighting_data'

// Data structure
{
    scenes: Array<[name, sceneObject]>,
    schedules: Array<[name, scheduleObject]>
}
```

### Room Configuration

Room mappings are based on the RV system configuration:

```javascript
const roomNames = {
    0: "Living Room",
    1: "Kitchen", 
    2: "Bedroom",
    3: "Bath",
    4: "Half Bath",
    5: "Exterior"
};
```

## Troubleshooting

### Common Issues

#### 1. Lights Not Discovered

**Symptoms**: `getAllLights()` returns empty array

**Solutions**:
- Verify WebSocket connection is established
- Check that `sendWSData` function is available
- Ensure PIN authentication is complete
- Try calling `initialize()` again

```javascript
// Debug light discovery
lightingController.initialize().then(lights => {
    console.log("Lights found:", lights.size);
}).catch(error => {
    console.error("Discovery failed:", error);
});
```

#### 2. Commands Not Working

**Symptoms**: Lights don't respond to brightness/toggle commands

**Solutions**:
- Verify `parserUtils` object is available
- Check WebSocket connection status
- Ensure light index is correct
- Test with manual WebSocket commands

```javascript
// Test manual command
sendWSData("GET_LIGHT_COUNT");

// Verify parserUtils
console.log(typeof parserUtils.packEvent);
```

#### 3. Schedules Not Triggering

**Symptoms**: Scheduled events don't execute

**Solutions**:
- Check system time synchronization
- Verify schedule is activated
- Confirm scene names exist
- Review browser console for errors

```javascript
// Debug schedule status
console.log("Active schedules:", lightingController.activeSchedules);
console.log("Schedule intervals:", lightingController.scheduleIntervals);
```

#### 4. Data Not Persisting

**Symptoms**: Scenes/schedules lost on page reload

**Solutions**:
- Check localStorage quota
- Verify JSON serialization
- Clear corrupted localStorage data

```javascript
// Clear stored data
localStorage.removeItem('rv_lighting_data');

// Check storage
console.log(localStorage.getItem('rv_lighting_data'));
```

### Debug Mode

Enable debug logging:

```javascript
// Add to RVLightingController constructor
this.debug = true;

// Or set globally
window.RV_LIGHTING_DEBUG = true;
```

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `INIT_TIMEOUT` | Initialization timeout | Check WebSocket connection |
| `LIGHT_NOT_FOUND` | Light index invalid | Verify light discovery |
| `SCENE_NOT_FOUND` | Scene doesn't exist | Check scene name spelling |
| `COMMAND_FAILED` | WebSocket command failed | Check connection status |

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Install development dependencies
4. Run tests before submitting

### Code Style

- Use ES6+ features
- Follow JSDoc commenting standards
- Maintain consistent indentation
- Add unit tests for new features

### Submitting Changes

1. Ensure all tests pass
2. Update documentation
3. Add example usage
4. Submit pull request with detailed description

### Reporting Issues

Include the following information:
- RV model and control system version
- Browser and version
- Steps to reproduce
- Console error messages
- Network tab WebSocket messages

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- SilverLeaf Electronics for the RV control system
- Newmar Corporation for lighting system specifications
- RV community for testing and feedback

## Support

- **Documentation**: See `/docs` folder for detailed guides
- **Examples**: Check `/examples` for implementation patterns
- **Issues**: Use GitHub Issues for bug reports
- **Discussions**: Use GitHub Discussions for questions

---

**Project Status**: Active Development
**Latest Version**: 1.0.0
**Compatibility**: SilverLeaf Electronics RV Control Systems, Newmar 2024+ Lighting Systems