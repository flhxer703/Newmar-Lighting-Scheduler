# RV Lighting System Troubleshooting Guide

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [Connection Issues](#connection-issues)
- [Initialization Problems](#initialization-problems)
- [Light Control Issues](#light-control-issues)
- [Scene Management Problems](#scene-management-problems)
- [Schedule Issues](#schedule-issues)
- [Performance Problems](#performance-problems)
- [Browser Compatibility](#browser-compatibility)
- [Network Troubleshooting](#network-troubleshooting)
- [System Recovery](#system-recovery)

## Quick Diagnosis

### Diagnostic Tool

Run this diagnostic script in your browser console to quickly identify issues:

```javascript
async function runDiagnostics() {
    console.log('🔍 RV Lighting System Diagnostics');
    console.log('================================');
    
    const results = {
        environment: checkEnvironment(),
        connection: await checkConnection(),
        dependencies: checkDependencies(),
        controller: await checkController(),
        storage: checkStorage()
    };
    
    console.table(results);
    
    // Generate recommendations
    generateRecommendations(results);
    
    return results;
}

function checkEnvironment() {
    return {
        userAgent: navigator.userAgent,
        url: window.location.href,
        protocol: window.location.protocol,
        localStorage: !!window.localStorage,
        webSocket: !!window.WebSocket,
        customEvents: !!window.CustomEvent
    };
}

async function checkConnection() {
    try {
        if (typeof sendWSData === 'function') {
            const testResult = sendWSData('ping');
            return { available: true, working: testResult };
        }
        return { available: false, working: false };
    } catch (error) {
        return { available: true, working: false, error: error.message };
    }
}

function checkDependencies() {
    return {
        sendWSData: typeof sendWSData === 'function',
        parserUtils: typeof parserUtils === 'object',
        RVLightingController: typeof RVLightingController === 'function',
        jQuery: typeof $ === 'function'
    };
}

async function checkController() {
    try {
        if (!window.lightingController) {
            return { exists: false };
        }
        
        const status = window.lightingController.getStatus();
        return {
            exists: true,
            initialized: status.initialized,
            lightsCount: status.lightsCount,
            scenesCount: status.scenesCount,
            schedulesCount: status.schedulesCount
        };
    } catch (error) {
        return { exists: true, error: error.message };
    }
}

function checkStorage() {
    try {
        const testKey = 'rv_test_' + Date.now();
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        
        const savedData = localStorage.getItem('rv_lighting_data');
        return {
            working: true,
            hasData: !!savedData,
            dataSize: savedData ? savedData.length : 0
        };
    } catch (error) {
        return { working: false, error: error.message };
    }
}

function generateRecommendations(results) {
    console.log('\n📋 Recommendations:');
    
    if (!results.dependencies.sendWSData) {
        console.log('❌ sendWSData function missing - Check WebSocket integration');
    }
    
    if (!results.dependencies.parserUtils) {
        console.log('❌ parserUtils missing - Include parser utility functions');
    }
    
    if (!results.connection.working) {
        console.log('❌ WebSocket connection not working - Check RV controller connection');
    }
    
    if (!results.controller.initialized) {
        console.log('❌ Controller not initialized - Run lightingController.initialize()');
    }
    
    if (!results.storage.working) {
        console.log('❌ Local storage not working - Check browser settings');
    }
}

// Run diagnostics
runDiagnostics();
```

## Connection Issues

### Issue: WebSocket Connection Failed

**Symptoms:**
- "Connection timeout" errors
- Red "Disconnected" status
- Cannot discover lights

**Diagnosis:**
```javascript
// Test WebSocket connection manually
function testWebSocketConnection() {
    const ws = new WebSocket('ws://192.168.1.100:8092/');
    
    ws.onopen = () => {
        console.log('✅ WebSocket connection successful');
        ws.close();
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket connection failed:', error);
    };
    
    ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
    };
    
    setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
            console.error('❌ Connection timeout');
            ws.close();
        }
    }, 5000);
}

testWebSocketConnection();
```

**Solutions:**

1. **Check IP Address**
   ```javascript
   // Find RV controller IP
   async function findRVController() {
       const baseIP = '192.168.1.';
       const promises = [];
       
       for (let i = 1; i < 255; i++) {
           const ip = baseIP + i;
           promises.push(
               fetch(`http://${ip}:8092/`, { 
                   method: 'HEAD', 
                   mode: 'no-cors',
                   timeout: 1000 
               })
               .then(() => ip)
               .catch(() => null)
           );
       }
       
       const results = await Promise.all(promises);
       const found = results.filter(ip => ip !== null);
       console.log('Found controllers at:', found);
       return found;
   }
   ```

2. **Check Port Availability**
   ```bash
   # On RV controller system
   netstat -an | grep :8092
   
   # Or check from another device
   telnet 192.168.1.100 8092
   ```

3. **Network Connectivity**
   ```javascript
   // Test basic connectivity
   function testConnectivity() {
       fetch('http://192.168.1.100:8092/', { 
           method: 'HEAD', 
           mode: 'no-cors' 
       })
       .then(() => console.log('✅ Can reach controller'))
       .catch(error => console.error('❌ Cannot reach controller:', error));
   }
   ```

### Issue: PIN Authentication Failed

**Symptoms:**
- "Incorrect PIN" messages
- "Locked PIN" errors
- Cannot access lighting system

**Solutions:**

1. **Reset PIN Attempts**
   ```javascript
   // Clear PIN attempt storage
   sessionStorage.removeItem('enteredPin');
   localStorage.removeItem('pin_attempts');
   
   // Wait for lockout to expire (usually 5 minutes)
   console.log('Wait 5 minutes for PIN lockout to expire');
   ```

2. **Check PIN Format**
   ```javascript
   function validatePIN(pin) {
       // Most RV systems expect 4-6 digit PIN
       if (!/^\d{4,6}$/.test(pin)) {
           console.error('PIN must be 4-6 digits');
           return false;
       }
       return true;
   }
   ```

3. **Manual PIN Entry**
   ```javascript
   // Bypass UI and send PIN directly
   function manualPINEntry(pin) {
       if (validatePIN(pin)) {
           sendWSData(`PIN=${pin}`);
       }
   }
   ```

## Initialization Problems

### Issue: Lights Not Discovered

**Symptoms:**
- "No lights found" message
- Empty lights list
- Initialization timeout

**Diagnosis:**
```javascript
// Debug light discovery process
function debugLightDiscovery() {
    console.log('Starting light discovery debug...');
    
    // Listen for all WebSocket messages
    const originalOnMessage = client.onmessage;
    client.onmessage = function(event) {
        console.log('WS Message:', event.data);
        originalOnMessage.call(this, event);
    };
    
    // Send discovery commands manually
    console.log('Requesting light count...');
    sendWSData('GET_LIGHT_COUNT');
    
    setTimeout(() => {
        console.log('Requesting first light object...');
        sendWSData('GET_LIGHT_OBJECT[0]');
    }, 2000);
}
```

**Solutions:**

1. **Manual Light Discovery**
   ```javascript
   // Manually discover lights
   async function manualLightDiscovery() {
       const controller = new RVLightingController();
       
       // Skip automatic discovery
       controller.isInitialized = true;
       
       // Add lights manually (if you know them)
       const knownLights = [
           { name: "Living Room Main", index: 1, room_loc: 0, command: 0 },
           { name: "Kitchen", index: 2, room_loc: 1, command: 1 }
       ];
       
       knownLights.forEach(light => {
           controller.lights.set(light.index, {
               name: light.name,
               index: light.index,
               room: light.room_loc,
               roomName: controller.roomNames[light.room_loc],
               isDimmer: light.command === 0,
               currentBrightness: 0
           });
       });
       
       return controller;
   }
   ```

2. **Check RV System Response**
   ```javascript
   // Test if RV system responds to commands
   function testRVSystemResponse() {
       // Set up listener for ANY response
       document.body.addEventListener('*', (event) => {
           console.log('Event received:', event.type, event.detail);
       });
       
       // Send test commands
       const commands = [
           'GET_LIGHT_COUNT',
           '?*!',
           'ping',
           'GET_SYSTEM_INFO'
       ];
       
       commands.forEach((cmd, index) => {
           setTimeout(() => {
               console.log(`Sending: ${cmd}`);
               sendWSData(cmd);
           }, index * 1000);
       });
   }
   ```

### Issue: Parser Utils Not Working

**Symptoms:**
- "parserUtils is not defined" errors
- Commands not formatted correctly
- Lights don't respond to commands

**Solutions:**

1. **Verify Parser Utils**
   ```javascript
   // Test parser utils functions
   function testParserUtils() {
       try {
           const instance = parserUtils.ESET_INSTANCE(1);
           const brightness = parserUtils.ESET_BRIGHTNESS(100);
           const packed = parserUtils.packEvent(instance, brightness);
           
           console.log('✅ Parser utils working:', packed);
           return true;
       } catch (error) {
           console.error('❌ Parser utils error:', error);
           return false;
       }
   }
   ```

2. **Provide Alternative Implementation**
   ```javascript
   // Fallback parser utils
   if (typeof parserUtils === 'undefined') {
       window.parserUtils = {
           ESET_INSTANCE: (instance) => (Math.round(instance) & 0xFF) << 8,
           ESET_BRIGHTNESS: (brightness) => Math.round(brightness) & 0xFF,
           ESET_LEVEL: (level) => Math.round(level) & 0xF,
           packEvent: (...args) => {
               const val = args.reduce((a, b) => a | b);
               const hex = val.toString(16).toUpperCase().padStart(4, '0');
               return `0x${hex}`;
           }
       };
       
       console.log('✅ Fallback parser utils loaded');
   }
   ```

## Light Control Issues

### Issue: Lights Don't Respond to Commands

**Symptoms:**
- Brightness sliders don't work
- Toggle buttons don't change lights
- Commands seem to send but no effect

**Diagnosis:**
```javascript
// Test individual light control
function testLightControl(lightIndex) {
    console.log(`Testing light ${lightIndex}...`);
    
    // Test brightness command
    const brightnessCmd = `HMSEVENT=ENEWMARDIMMERPARSER_SET_BRIGHTNESS_NONSCALED|${parserUtils.packEvent(parserUtils.ESET_INSTANCE(lightIndex), parserUtils.ESET_BRIGHTNESS(100))}`;
    console.log('Brightness command:', brightnessCmd);
    sendWSData(brightnessCmd);
    
    setTimeout(() => {
        // Test on/off command
        const onOffCmd = `HMSEVENT=ENEWMARDIMMERPARSER_TURN_ON_OFF|${parserUtils.packEvent(parserUtils.ESET_INSTANCE(lightIndex), parserUtils.ESET_LEVEL(1))}`;
        console.log('On/Off command:', onOffCmd);
        sendWSData(onOffCmd);
    }, 2000);
}
```

**Solutions:**

1. **Check Light Index Mapping**
   ```javascript
   // Verify light indices are correct
   function verifyLightIndices() {
       const controller = window.lightingController;
       if (!controller) return;
       
       controller.getAllLights().forEach(light => {
           console.log(`Light "${light.name}": index=${light.index}, instance=${light.instance}`);
           
           // Test if light responds
           setTimeout(() => {
               controller.setLightBrightness(light.index, 50);
           }, light.index * 1000);
       });
   }
   ```

2. **Alternative Command Formats**
   ```javascript
   // Try different command formats
   function tryAlternativeCommands(lightIndex) {
       const commands = [
           // Standard format
           `HMSEVENT=ENEWMARDIMMERPARSER_SET_BRIGHTNESS_NONSCALED|${parserUtils.packEvent(parserUtils.ESET_INSTANCE(lightIndex), parserUtils.ESET_BRIGHTNESS(100))}`,
           
           // Alternative formats (try if standard doesn't work)
           `SET_LIGHT_BRIGHTNESS=${lightIndex},100`,
           `LIGHT_CONTROL=${lightIndex}:100`,
           `DIMMER_${lightIndex}=100`
       ];
       
       commands.forEach((cmd, index) => {
           setTimeout(() => {
               console.log(`Trying command ${index + 1}:`, cmd);
               sendWSData(cmd);
           }, index * 2000);
       });
   }
   ```

3. **Check for Response Delays**
   ```javascript
   // Some systems have delays in processing commands
   function testWithDelays(lightIndex, brightness) {
       console.log(`Setting light ${lightIndex} to ${brightness}% with delays...`);
       
       const cmd = `HMSEVENT=ENEWMARDIMMERPARSER_SET_BRIGHTNESS_NONSCALED|${parserUtils.packEvent(parserUtils.ESET_INSTANCE(lightIndex), parserUtils.ESET_BRIGHTNESS(brightness))}`;
       
       sendWSData(cmd);
       
       // Check status after delays
       [1000, 3000, 5000].forEach(delay => {
           setTimeout(() => {
               sendWSData(`NEWMAR_DIMMER_BRIGHTNESS[${lightIndex}]`);
           }, delay);
       });
   }
   ```

### Issue: Inconsistent Light Behavior

**Symptoms:**
- Some lights work, others don't
- Random failures
- Intermittent response

**Solutions:**

1. **Implement Retry Logic**
   ```javascript
   // Robust light control with retries
   async function robustLightControl(lightIndex, brightness, maxRetries = 3) {
       for (let attempt = 1; attempt <= maxRetries; attempt++) {
           try {
               console.log(`Attempt ${attempt} to control light ${lightIndex}`);
               
               const success = lightingController.setLightBrightness(lightIndex, brightness);
               
               if (success) {
                   // Verify the change took effect
                   await new Promise(resolve => setTimeout(resolve, 1000));
                   
                   const actualBrightness = await lightingController.getCurrentBrightness(lightIndex);
                   if (Math.abs(actualBrightness - brightness) < 5) {
                       console.log(`✅ Light ${lightIndex} successfully set to ${brightness}%`);
                       return true;
                   }
               }
               
               if (attempt < maxRetries) {
                   console.log(`Retry ${attempt} failed, waiting before next attempt...`);
                   await new Promise(resolve => setTimeout(resolve, 2000));
               }
               
           } catch (error) {
               console.error(`Attempt ${attempt} error:`, error);
           }
       }
       
       console.error(`❌ Failed to control light ${lightIndex} after ${maxRetries} attempts`);
       return false;
   }
   ```

2. **Check System Load**
   ```javascript
   // Monitor system performance during light control
   function monitorSystemDuringControl() {
       const startTime = performance.now();
       const startMemory = performance.memory?.usedJSHeapSize || 0;
       
       // Perform light control
       lightingController.setLightBrightness(1, 75);
       
       setTimeout(() => {
           const endTime = performance.now();
           const endMemory = performance.memory?.usedJSHeapSize || 0;
           
           console.log('Performance metrics:', {
               duration: `${endTime - startTime}ms`,
               memoryChange: `${((endMemory - startMemory) / 1024).toFixed(2)}KB`
           });
       }, 1000);
   }
   ```

## Scene Management Problems

### Issue: Scenes Not Saving

**Symptoms:**
- "Scene saved" message but scene doesn't appear
- Scenes disappear after page reload
- Save operation fails silently

**Diagnosis:**
```javascript
// Debug scene saving
function debugSceneSaving() {
    const controller = window.lightingController;
    if (!controller) {
        console.error('Controller not available');
        return;
    }
    
    console.log('Testing scene save...');
    
    // Monitor storage before and after
    const beforeData = localStorage.getItem('rv_lighting_data');
    console.log('Storage before:', beforeData ? 'Has data' : 'Empty');
    
    // Attempt to save a test scene
    controller.saveScene('Test Scene').then(success => {
        console.log('Save result:', success);
        
        const afterData = localStorage.getItem('rv_lighting_data');
        console.log('Storage after:', afterData ? 'Has data' : 'Empty');
        
        if (afterData) {
            try {
                const parsed = JSON.parse(afterData);
                console.log('Saved scenes:', parsed.scenes?.length || 0);
            } catch (error) {
                console.error('Storage data corrupted:', error);
            }
        }
    });
}
```

**Solutions:**

1. **Check Local Storage Quota**
   ```javascript
   // Test storage availability
   function checkStorageQuota() {
       try {
           const testData = 'x'.repeat(1024 * 1024); // 1MB test
           localStorage.setItem('storage_test', testData);
           localStorage.removeItem('storage_test');
           console.log('✅ Storage quota sufficient');
           return true;
       } catch (error) {
           if (error.name === 'QuotaExceededError') {
               console.error('❌ Storage quota exceeded');
               
               // Show storage usage
               let totalSize = 0;
               Object.keys(localStorage).forEach(key => {
                   totalSize += localStorage.getItem(key).length;
               });
               console.log(`Current storage usage: ${(totalSize / 1024).toFixed(2)}KB`);
               
               return false;
           }
           console.error('❌ Storage error:', error);
           return false;
       }
   }
   ```

2. **Clear Corrupted Data**
   ```javascript
   // Fix corrupted storage data
   function fixCorruptedStorage() {
       try {
           const data = localStorage.getItem('rv_lighting_data');
           if (!data) {
               console.log('No stored data found');
               return;
           }
           
           JSON.parse(data); // Test if valid JSON
           console.log('✅ Storage data is valid');
           
       } catch (error) {
           console.error('❌ Storage data corrupted, clearing...');
           localStorage.removeItem('rv_lighting_data');
           
           // Reinitialize with empty data
           const emptyData = {
               scenes: [],
               schedules: [],
               version: "1.0.0",
               lastSaved: new Date().toISOString()
           };
           
           localStorage.setItem('rv_lighting_data', JSON.stringify(emptyData));
           console.log('✅ Storage reset with empty data');
       }
   }
   ```

3. **Alternative Storage Method**
   ```javascript
   // Use alternative storage if localStorage fails
   class AlternativeStorage {
       constructor() {
           this.data = new Map();
           this.loadFromCookies();
       }
       
       save(key, value) {
           this.data.set(key, value);
           this.saveToCookies();
       }
       
       load(key) {
           return this.data.get(key);
       }
       
       saveToCookies() {
           try {
               const dataStr = JSON.stringify(Array.from(this.data.entries()));
               document.cookie = `rv_lighting_backup=${encodeURIComponent(dataStr)}; max-age=2592000`; // 30 days
           } catch (error) {
               console.error('Cookie storage failed:', error);
           }
       }
       
       loadFromCookies() {
           const cookies = document.cookie.split(';');
           const backupCookie = cookies.find(c => c.trim().startsWith('rv_lighting_backup='));
           
           if (backupCookie) {
               try {
                   const dataStr = decodeURIComponent(backupCookie.split('=')[1]);
                   const entries = JSON.parse(dataStr);
                   this.data = new Map(entries);
                   console.log('Loaded data from cookies');
               } catch (error) {
                   console.error('Failed to load from cookies:', error);
               }
           }
       }
   }
   ```

### Issue: Scenes Not Loading Correctly

**Symptoms:**
- Scene loads but lights don't change
- Only some lights in scene respond
- Scene appears corrupted

**Solutions:**

1. **Validate Scene Data**
   ```javascript
   // Check scene integrity
   function validateScene(sceneName) {
       const controller = window.lightingController;
       const scene = controller.scenes.get(sceneName);
       
       if (!scene) {
           console.error(`Scene "${sceneName}" not found`);
           return false;
       }
       
       console.log(`Validating scene "${sceneName}"`);
       console.log(`Created: ${scene.created}`);
       console.log(`Lights in scene: ${scene.lights.length}`);
       
       let validLights = 0;
       scene.lights.forEach(lightState => {
           const light = controller.lights.get(lightState.index);
           if (light) {
               validLights++;
               console.log(`✅ Light ${lightState.index} (${lightState.name}) - ${lightState.brightness}%`);
           } else {
               console.error(`❌ Light ${lightState.index} not found in system`);
           }
       });
       
       console.log(`Valid lights: ${validLights}/${scene.lights.length}`);
       return validLights === scene.lights.length;
   }
   ```

2. **Repair Scene Data**
   ```javascript
   // Fix scene with missing lights
   function repairScene(sceneName) {
       const controller = window.lightingController;
       const scene = controller.scenes.get(sceneName);
       
       if (!scene) return false;
       
       const validLights = scene.lights.filter(lightState => 
           controller.lights.has(lightState.index)
       );
       
       if (validLights.length !== scene.lights.length) {
           console.log(`Repairing scene "${sceneName}": removing ${scene.lights.length - validLights.length} invalid lights`);
           
           scene.lights = validLights;
           controller.scenes.set(sceneName, scene);
           controller.saveToStorage();
           
           return true;
       }
       
       return false;
   }
   ```

## Schedule Issues

### Issue: Schedules Not Triggering

**Symptoms:**
- Scheduled events don't execute
- Schedule shows as active but doesn't work
- Time-based events fire at wrong times

**Diagnosis:**
```javascript
// Debug schedule execution
function debugSchedules() {
    const controller = window.lightingController;
    if (!controller) return;
    
    console.log('Active schedules:', Array.from(controller.activeSchedules));
    console.log('Schedule intervals:', controller.scheduleIntervals.size);
    
    // Check system time
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dayString = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    
    console.log(`Current time: ${timeString} (${dayString})`);
    
    // Check each schedule
    controller.schedules.forEach((schedule, name) => {
        console.log(`\nSchedule: ${name}`);
        console.log(`Enabled: ${schedule.enabled}`);
        console.log(`Active: ${controller.activeSchedules.has(name)}`);
        
        schedule.events.forEach((event, index) => {
            const willTrigger = event.time === timeString && event.days.includes(dayString);
            console.log(`Event ${index + 1}: ${event.time} [${event.days.join(',')}] ${event.action} ${willTrigger ? '🔥 WILL TRIGGER' : ''}`);
        });
    });
}
```

**Solutions:**

1. **Fix Time Zone Issues**
   ```javascript
   // Account for time zone differences
   function createScheduleWithTimeZone(scheduleName, events, timeZone = null) {
       const adjustedEvents = events.map(event => {
           if (timeZone) {
               // Convert time to local time zone
               const eventDate = new Date(`1970-01-01T${event.time}:00`);
               const localTime = eventDate.toLocaleTimeString('en-US', {
                   hour12: false,
                   timeZone: timeZone
               }).substring(0, 5);
               
               return { ...event, time: localTime };
           }
           return event;
       });
       
       return lightingController.createSchedule(scheduleName, adjustedEvents);
   }
   ```

2. **Manual Schedule Trigger**
   ```javascript
   // Manually trigger schedule events for testing
   function triggerScheduleEvent(scheduleName, eventIndex) {
       const controller = window.lightingController;
       const schedule = controller.schedules.get(scheduleName);
       
       if (!schedule || !schedule.events[eventIndex]) {
           console.error('Schedule or event not found');
           return false;
       }
       
       const event = schedule.events[eventIndex];
       console.log(`Manually triggering: ${event.action}`);
       
       switch (event.action) {
           case 'load_scene':
               return controller.loadScene(event.scene);
           case 'lights_off':
               controller.allLightsOff();
               return true;
           case 'lights_on':
               controller.allLightsOn();
               return true;
           default:
               console.error('Unknown action:', event.action);
               return false;
       }
   }
   ```

3. **Schedule Recovery System**
   ```javascript
   // Automatic schedule recovery
   function setupScheduleRecovery() {
       const controller = window.lightingController;
       
       // Check every 5 minutes if schedules are still active
       setInterval(() => {
           const expectedActive = Array.from(controller.schedules.keys()).filter(name => 
               controller.schedules.get(name).enabled
           );
           
           const actualActive = Array.from(controller.activeSchedules);
           
           expectedActive.forEach(scheduleName => {
               if (!actualActive.includes(scheduleName)) {
                   console.log(`Recovering schedule: ${scheduleName}`);
                   controller.activateSchedule(scheduleName);
               }
           });
       }, 300000); // 5 minutes
   }
   ```

## Performance Problems

### Issue: Slow Response Times

**Symptoms:**
- Delays when controlling lights
- UI becomes unresponsive
- Long initialization times

**Solutions:**

1. **Optimize Light Control**
   ```javascript
   // Batch light operations
   class OptimizedLightController extends RVLightingController {
       constructor() {
           super();
           this.commandQueue = [];
           this.isProcessing = false;
       }
       
       async setLightBrightness(lightIndex, brightness) {
           return new Promise((resolve) => {
               this.commandQueue.push({
                   type: 'brightness',
                   lightIndex,
                   brightness,
                   resolve
               });
               
               this.processQueue();
           });
       }
       
       async processQueue() {
           if (this.isProcessing || this.commandQueue.length === 0) return;
           
           this.isProcessing = true;
           
           while (this.commandQueue.length > 0) {
               const command = this.commandQueue.shift();
               
               try {
                   const result = await this.executeCommand(command);
                   command.resolve(result);
               } catch (error) {
                   command.resolve(false);
               }
               
               // Small delay between commands to prevent overwhelming the system
               await new Promise(resolve => setTimeout(resolve, 100));
           }
           
           this.isProcessing = false;
       }
       
       async executeCommand(command) {
           switch (command.type) {
               case 'brightness':
                   return super.setLightBrightness(command.lightIndex, command.brightness);
               default:
                   return false;
           }
       }
   }
   ```

2. **Reduce Memory Usage**
   ```javascript
   // Clean up unused data
   function optimizeMemoryUsage() {
       const controller = window.lightingController;
       if (!controller) return;
       
       // Remove old log entries
       document.querySelectorAll('.log-entry').forEach((entry, index) => {
           if (index > 50) entry.remove(); // Keep only last 50 entries
       });
       
       // Clean up event handlers
       controller.cleanup();
       
       // Force garbage collection if available
       if (window.gc) {
           window.gc();
       }
       
       console.log('Memory optimization completed');
   }
   
   // Run optimization every 10 minutes
   setInterval(optimizeMemoryUsage, 600000);
   ```

### Issue: High Memory Usage

**Solutions:**

1. **Memory Monitoring**
   ```javascript
   // Monitor memory usage
   function monitorMemory() {
       if (!performance.memory) {
           console.log('Memory monitoring not available');
           return;
       }
       
       const formatBytes = (bytes) => (bytes / 1024 / 1024).toFixed(2) + 'MB';
       
       const usage = {
           used: formatBytes(performance.memory.usedJSHeapSize),
           total: formatBytes(performance.memory.totalJSHeapSize),
           limit: formatBytes(performance.memory.jsHeapSizeLimit)
       };
       
       console.table(usage);
       
       // Alert if usage is high
       const usedPercentage = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
       if (usedPercentage > 80) {
           console.warn(`⚠️ High memory usage: ${usedPercentage.toFixed(1)}%`);
           optimizeMemoryUsage();
       }
   }
   
   // Monitor every minute
   setInterval(monitorMemory, 60000);
   ```

## Browser Compatibility

### Issue: Features Not Working in Older Browsers

**Solutions:**

1. **Feature Detection**
   ```javascript
   // Check for required features
   function checkBrowserCompatibility() {
       const features = {
           webSocket: !!window.WebSocket,
           localStorage: !!window.localStorage,
           customEvents: !!window.CustomEvent,
           promises: !!window.Promise,
           fetch: !!window.fetch,
           es6Classes: (() => {
               try {
                   eval('class Test {}');
                   return true;
               } catch (e) {
                   return false;
               }
           })(),
           asyncAwait: (() => {
               try {
                   eval('async function test() {}');
                   return true;
               } catch (e) {
                   return false;
               }
           })()
       };
       
       const unsupported = Object.entries(features)
           .filter(([name, supported]) => !supported)
           .map(([name]) => name);
       
       if (unsupported.length > 0) {
           console.error('Unsupported features:', unsupported);
           showBrowserWarning(unsupported);
           return false;
       }
       
       console.log('✅ Browser fully compatible');
       return true;
   }
   
   function showBrowserWarning(unsupportedFeatures) {
       const warning = document.createElement('div');
       warning.style.cssText = `
           position: fixed;
           top: 20px;
           left: 50%;
           transform: translateX(-50%);
           background: #ff6b6b;
           color: white;
           padding: 15px;
           border-radius: 5px;
           z-index: 10000;
           font-family: Arial, sans-serif;
       `;
       warning.innerHTML = `
           <strong>Browser Compatibility Warning</strong><br>
           Your browser doesn't support: ${unsupportedFeatures.join(', ')}<br>
           Please update your browser for full functionality.
       `;
       document.body.appendChild(warning);
   }
   ```

2. **Polyfills**
   ```javascript
   // Add polyfills for missing features
   function loadPolyfills() {
       const polyfills = [];
       
       if (!window.Promise) {
           polyfills.push('https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.auto.min.js');
       }
       
       if (!window.fetch) {
           polyfills.push('https://cdn.jsdelivr.net/npm/whatwg-fetch@3/fetch.js');
       }
       
       if (!window.CustomEvent) {
           // CustomEvent polyfill
           window.CustomEvent = function(event, params) {
               params = params || { bubbles: false, cancelable: false, detail: undefined };
               const evt = document.createEvent('CustomEvent');
               evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
               return evt;
           };
       }
       
       // Load external polyfills
       polyfills.forEach(url => {
           const script = document.createElement('script');
           script.src = url;
           document.head.appendChild(script);
       });
       
       return polyfills.length > 0;
   }
   ```

## Network Troubleshooting

### Issue: Intermittent Network Problems

**Solutions:**

1. **Network Health Monitor**
   ```javascript
   // Monitor network connectivity
   class NetworkMonitor {
       constructor() {
           this.isOnline = navigator.onLine;
           this.setupEventListeners();
           this.startLatencyMonitoring();
       }
       
       setupEventListeners() {
           window.addEventListener('online', () => {
               this.isOnline = true;
               console.log('🌐 Network connection restored');
               this.reconnectLightingSystem();
           });
           
           window.addEventListener('offline', () => {
               this.isOnline = false;
               console.log('🔌 Network connection lost');
           });
       }
       
       startLatencyMonitoring() {
           setInterval(() => {
               this.checkLatency();
           }, 30000); // Check every 30 seconds
       }
       
       async checkLatency() {
           try {
               const start = Date.now();
               await fetch('/ping', { method: 'HEAD', cache: 'no-cache' });
               const latency = Date.now() - start;
               
               if (latency > 5000) {
                   console.warn(`⚠️ High network latency: ${latency}ms`);
               }
           } catch (error) {
               console.error('Network check failed:', error);
           }
       }
       
       reconnectLightingSystem() {
           if (window.lightingController && !window.lightingController.isInitialized) {
               setTimeout(() => {
                   window.lightingController.initialize();
               }, 2000);
           }
       }
   }
   
   const networkMonitor = new NetworkMonitor();
   ```

## System Recovery

### Emergency Recovery Procedures

1. **Complete System Reset**
   ```javascript
   // Nuclear option: reset everything
   function emergencyReset() {
       console.log('🚨 Performing emergency system reset...');
       
       // Clear all stored data
       localStorage.removeItem('rv_lighting_data');
       sessionStorage.clear();
       
       // Remove event listeners
       if (window.lightingController) {
           window.lightingController.cleanup();
           window.lightingController = null;
       }
       
       // Close WebSocket connection
       if (window.client) {
           window.client.close();
           window.client = null;
       }
       
       // Reload page
       setTimeout(() => {
           location.reload(true);
       }, 1000);
   }
   ```

2. **Safe Mode Operation**
   ```javascript
   // Minimal functionality mode
   function enterSafeMode() {
       console.log('🛡️ Entering safe mode...');
       
       // Disable all advanced features
       window.RV_SAFE_MODE = true;
       
       // Create minimal controller
       window.safeLightingController = {
           setLightBrightness: (index, brightness) => {
               const cmd = `SIMPLE_LIGHT_${index}=${brightness}`;
               return sendWSData(cmd);
           },
           
           allLightsOff: () => {
               return sendWSData('ALL_LIGHTS_OFF');
           },
           
           allLightsOn: () => {
               return sendWSData('ALL_LIGHTS_ON');
           }
       };
       
       console.log('Safe mode active - basic functions only');
   }
   ```

3. **Data Recovery**
   ```javascript
   // Attempt to recover from backup data
   function recoverData() {
       console.log('🔧 Attempting data recovery...');
       
       // Check for backup in cookies
       const backupData = getCookieBackup();
       if (backupData) {
           console.log('Found cookie backup, restoring...');
           localStorage.setItem('rv_lighting_data', backupData);
           return true;
       }
       
       // Check for exported files in downloads
       console.log('No automatic backup found. Please import backup file if available.');
       return false;
   }
   
   function getCookieBackup() {
       const cookies = document.cookie.split(';');
       const backupCookie = cookies.find(c => 
           c.trim().startsWith('rv_lighting_backup=')
       );
       
       if (backupCookie) {
           try {
               return decodeURIComponent(backupCookie.split('=')[1]);
           } catch (error) {
               console.error('Backup cookie corrupted:', error);
           }
       }
       
       return null;
   }
   ```

### Support Information Collection

```javascript
// Collect diagnostic information for support
function collectSupportInfo() {
    const info = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: location.href,
        
        // System status
        lightingControllerExists: !!window.lightingController,
        isInitialized: window.lightingController?.isInitialized || false,
        lightsCount: window.lightingController?.lights?.size || 0,
        
        // Dependencies
        sendWSDataExists: typeof sendWSData === 'function',
        parserUtilsExists: typeof parserUtils === 'object',
        webSocketState: window.client?.readyState || 'Not available',
        
        // Storage
        localStorageWorks: (() => {
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch (e) {
                return false;
            }
        })(),
        
        // Errors from console
        recentErrors: window.console.errors || 'Not captured',
        
        // Performance
        memory: performance.memory ? {
            used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
            total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB'
        } : 'Not available'
    };
    
    console.log('📋 Support Information:');
    console.log(JSON.stringify(info, null, 2));
    
    // Copy to clipboard if possible
    if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(info, null, 2))
            .then(() => console.log('📋 Support info copied to clipboard'));
    }
    
    return info;
}
```

This troubleshooting guide covers the most common issues and provides systematic approaches to diagnose and resolve problems with the RV Lighting System. Use the diagnostic tools to quickly identify issues and follow the appropriate solutions for your specific problem.