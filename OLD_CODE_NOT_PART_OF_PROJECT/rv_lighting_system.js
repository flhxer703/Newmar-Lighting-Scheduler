/**
 * RV Lighting Scenes & Schedules System
 * Compatible with Newmar 2024 Lighting System
 * Requires: WebSocket connection (sendWSData function) and parserUtils
 */

class RVLightingController {
    constructor() {
        this.lights = new Map();
        this.scenes = new Map();
        this.schedules = new Map();
        this.activeSchedules = new Set();
        this.scheduleIntervals = new Map();
        this.isInitialized = false;
        
        // Room definitions
        this.rooms = {
            LIVING_ROOM: 0,
            KITCHEN: 1,
            BEDROOM: 2,
            BATH: 3,
            HALF_BATH: 4,
            EXTERIOR: 5
        };
        
        this.roomNames = {
            0: "Living Room",
            1: "Kitchen", 
            2: "Bedroom",
            3: "Bath",
            4: "Half Bath",
            5: "Exterior"
        };
        
        // Load saved data from localStorage
        this.loadSavedData();
    }
    
    /**
     * Initialize the lighting system by discovering all lights
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            console.log("Initializing RV Lighting Controller...");
            
            // Set up event listener for light count
            $('body').addClass('event_GET_LIGHT_COUNT')
                .one('GET_LIGHT_COUNT', (e, count) => {
                    console.log(`Discovered ${count} lights`);
                    let receivedCount = 0;
                    
                    // Get each light object
                    for(let i = 0; i < count; i++) {
                        $('body').addClass(`event_GET_LIGHT_OBJECT_${i}`)
                            .one(`GET_LIGHT_OBJECT[${i}]`, (e, objectString) => {
                                try {
                                    const lightObject = JSON.parse(objectString);
                                    
                                    // Store light info
                                    this.lights.set(lightObject.index, {
                                        name: lightObject.name.replace("|", " "),
                                        index: lightObject.index,
                                        instance: lightObject.instance,
                                        command: lightObject.command,
                                        room: lightObject.room_loc,
                                        roomName: this.roomNames[lightObject.room_loc],
                                        isDimmer: parseInt(lightObject.command) === 0,
                                        currentBrightness: 0
                                    });
                                    
                                    receivedCount++;
                                    if(receivedCount === count) {
                                        this.isInitialized = true;
                                        console.log("Lighting controller initialized successfully");
                                        resolve(this.lights);
                                    }
                                } catch(error) {
                                    console.error("Error parsing light object:", error);
                                }
                                
                                $('body').removeClass(`event_GET_LIGHT_OBJECT_${i}`);
                                sendWSData(`GET_LIGHT_OBJECT[${i}]`);
                            });
                    }
                });
            
            // Request light count to start discovery
            sendWSData("GET_LIGHT_COUNT");
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if(!this.isInitialized) {
                    reject(new Error("Lighting system initialization timeout"));
                }
            }, 10000);
        });
    }
    
    /**
     * Get all available lights
     */
    getAllLights() {
        return Array.from(this.lights.values());
    }
    
    /**
     * Get lights by room
     */
    getLightsByRoom(roomId) {
        return this.getAllLights().filter(light => light.room === roomId);
    }
    
    /**
     * Set brightness for a specific light
     */
    setLightBrightness(lightIndex, brightness) {
        const light = this.lights.get(lightIndex);
        if(!light) {
            console.error(`Light ${lightIndex} not found`);
            return false;
        }
        
        // Clamp brightness to 0-100
        brightness = Math.max(0, Math.min(100, brightness));
        
        if(light.isDimmer) {
            // For dimmers, use brightness command (scale to 0-200 for the system)
            const scaledBrightness = Math.round((brightness / 100) * 200);
            const command = `HMSEVENT=ENEWMARDIMMERPARSER_SET_BRIGHTNESS_NONSCALED|${parserUtils.packEvent(parserUtils.ESET_INSTANCE(lightIndex), parserUtils.ESET_BRIGHTNESS(scaledBrightness))}`;
            sendWSData(command);
        } else {
            // For switches, use on/off command
            const level = brightness > 0 ? 0x01 : 0x00;
            const command = `HMSEVENT=ENEWMARDIMMERPARSER_TURN_ON_OFF|${parserUtils.packEvent(parserUtils.ESET_INSTANCE(lightIndex), parserUtils.ESET_LEVEL(level))}`;
            sendWSData(command);
        }
        
        // Update local state
        light.currentBrightness = brightness;
        console.log(`Set ${light.name} to ${brightness}%`);
        return true;
    }
    
    /**
     * Toggle light on/off
     */
    toggleLight(lightIndex, state = null) {
        const light = this.lights.get(lightIndex);
        if(!light) return false;
        
        if(state === null) {
            // Toggle current state
            state = light.currentBrightness === 0;
        }
        
        const brightness = state ? 100 : 0;
        return this.setLightBrightness(lightIndex, brightness);
    }
    
    /**
     * Save current light states as a scene
     */
    async saveScene(sceneName, roomFilter = null) {
        if(!this.isInitialized) {
            console.error("Lighting controller not initialized");
            return false;
        }
        
        // Get current brightness levels for all lights
        const lightStates = [];
        
        for(const light of this.lights.values()) {
            if(roomFilter !== null && light.room !== roomFilter) continue;
            
            // Request current brightness
            await this.getCurrentBrightness(light.index);
            
            lightStates.push({
                index: light.index,
                name: light.name,
                brightness: light.currentBrightness,
                room: light.room
            });
        }
        
        const scene = {
            name: sceneName,
            created: new Date().toISOString(),
            room: roomFilter,
            lights: lightStates
        };
        
        this.scenes.set(sceneName, scene);
        this.saveToStorage();
        
        console.log(`Scene "${sceneName}" saved with ${lightStates.length} lights`);
        return true;
    }
    
    /**
     * Load and activate a scene
     */
    loadScene(sceneName) {
        const scene = this.scenes.get(sceneName);
        if(!scene) {
            console.error(`Scene "${sceneName}" not found`);
            return false;
        }
        
        console.log(`Loading scene: ${sceneName}`);
        
        // Apply each light setting
        for(const lightState of scene.lights) {
            this.setLightBrightness(lightState.index, lightState.brightness);
        }
        
        return true;
    }
    
    /**
     * Delete a scene
     */
    deleteScene(sceneName) {
        if(this.scenes.delete(sceneName)) {
            this.saveToStorage();
            console.log(`Scene "${sceneName}" deleted`);
            return true;
        }
        return false;
    }
    
    /**
     * Get all saved scenes
     */
    getAllScenes() {
        return Array.from(this.scenes.values());
    }
    
    /**
     * Create a lighting schedule
     */
    createSchedule(scheduleName, events) {
        const schedule = {
            name: scheduleName,
            enabled: true,
            created: new Date().toISOString(),
            events: events.map(event => ({
                time: event.time,  // "HH:MM" format
                days: event.days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                scene: event.scene,
                action: event.action || 'load_scene' // 'load_scene', 'lights_off', 'lights_on'
            }))
        };
        
        this.schedules.set(scheduleName, schedule);
        this.saveToStorage();
        
        console.log(`Schedule "${scheduleName}" created with ${events.length} events`);
        return true;
    }
    
    /**
     * Activate a schedule
     */
    activateSchedule(scheduleName) {
        const schedule = this.schedules.get(scheduleName);
        if(!schedule) {
            console.error(`Schedule "${scheduleName}" not found`);
            return false;
        }
        
        if(this.activeSchedules.has(scheduleName)) {
            console.log(`Schedule "${scheduleName}" already active`);
            return true;
        }
        
        this.activeSchedules.add(scheduleName);
        
        // Set up interval to check schedule every minute
        const intervalId = setInterval(() => {
            this.checkScheduleEvents(scheduleName);
        }, 60000); // Check every minute
        
        this.scheduleIntervals.set(scheduleName, intervalId);
        
        console.log(`Schedule "${scheduleName}" activated`);
        return true;
    }
    
    /**
     * Deactivate a schedule
     */
    deactivateSchedule(scheduleName) {
        if(!this.activeSchedules.has(scheduleName)) {
            return false;
        }
        
        const intervalId = this.scheduleIntervals.get(scheduleName);
        if(intervalId) {
            clearInterval(intervalId);
            this.scheduleIntervals.delete(scheduleName);
        }
        
        this.activeSchedules.delete(scheduleName);
        console.log(`Schedule "${scheduleName}" deactivated`);
        return true;
    }
    
    /**
     * Check if any scheduled events should trigger
     */
    checkScheduleEvents(scheduleName) {
        const schedule = this.schedules.get(scheduleName);
        if(!schedule || !schedule.enabled) return;
        
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
        
        for(const event of schedule.events) {
            if(event.time === currentTime && event.days.includes(currentDay)) {
                console.log(`Triggering scheduled event: ${event.action} at ${currentTime}`);
                
                switch(event.action) {
                    case 'load_scene':
                        this.loadScene(event.scene);
                        break;
                    case 'lights_off':
                        this.allLightsOff();
                        break;
                    case 'lights_on':
                        this.allLightsOn();
                        break;
                }
            }
        }
    }
    
    /**
     * Turn all lights off
     */
    allLightsOff() {
        for(const light of this.lights.values()) {
            this.setLightBrightness(light.index, 0);
        }
        console.log("All lights turned off");
    }
    
    /**
     * Turn all lights on
     */
    allLightsOn() {
        for(const light of this.lights.values()) {
            this.setLightBrightness(light.index, 100);
        }
        console.log("All lights turned on");
    }
    
    /**
     * Get current brightness for a light
     */
    async getCurrentBrightness(lightIndex) {
        return new Promise((resolve) => {
            const eventName = `NEWMAR_DIMMER_BRIGHTNESS[${lightIndex}]`;
            
            $('body').addClass(`event_${eventName}`)
                .one(eventName, (e, brightness) => {
                    const level = parseInt(brightness.replace("%", ""));
                    const light = this.lights.get(lightIndex);
                    if(light) {
                        light.currentBrightness = level;
                    }
                    $('body').removeClass(`event_${eventName}`);
                    resolve(level);
                });
            
            sendWSData(`NEWMAR_DIMMER_BRIGHTNESS[${lightIndex}]`);
        });
    }
    
    /**
     * Save data to localStorage
     */
    saveToStorage() {
        const data = {
            scenes: Array.from(this.scenes.entries()),
            schedules: Array.from(this.schedules.entries())
        };
        localStorage.setItem('rv_lighting_data', JSON.stringify(data));
    }
    
    /**
     * Load data from localStorage
     */
    loadSavedData() {
        try {
            const data = JSON.parse(localStorage.getItem('rv_lighting_data') || '{}');
            
            if(data.scenes) {
                this.scenes = new Map(data.scenes);
            }
            
            if(data.schedules) {
                this.schedules = new Map(data.schedules);
            }
            
            console.log(`Loaded ${this.scenes.size} scenes and ${this.schedules.size} schedules`);
        } catch(error) {
            console.error("Error loading saved lighting data:", error);
        }
    }
    
    /**
     * Export configuration
     */
    exportConfig() {
        return {
            scenes: this.getAllScenes(),
            schedules: Array.from(this.schedules.values()),
            exportDate: new Date().toISOString()
        };
    }
    
    /**
     * Import configuration
     */
    importConfig(config) {
        try {
            if(config.scenes) {
                for(const scene of config.scenes) {
                    this.scenes.set(scene.name, scene);
                }
            }
            
            if(config.schedules) {
                for(const schedule of config.schedules) {
                    this.schedules.set(schedule.name, schedule);
                }
            }
            
            this.saveToStorage();
            console.log("Configuration imported successfully");
            return true;
        } catch(error) {
            console.error("Error importing configuration:", error);
            return false;
        }
    }
}

// Usage Example:
/*
// Initialize the lighting controller
const lightingController = new RVLightingController();

// Initialize and discover lights
lightingController.initialize().then(() => {
    console.log("Lighting system ready!");
    
    // Example: Save current state as "Evening" scene
    lightingController.saveScene("Evening");
    
    // Example: Create a schedule
    lightingController.createSchedule("Daily Schedule", [
        {
            time: "07:00",
            days: ["mon", "tue", "wed", "thu", "fri"],
            action: "load_scene",
            scene: "Morning"
        },
        {
            time: "22:00", 
            days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
            action: "lights_off"
        }
    ]);
    
    // Activate the schedule
    lightingController.activateSchedule("Daily Schedule");
    
}).catch(error => {
    console.error("Failed to initialize lighting system:", error);
});

// Manual controls
// lightingController.setLightBrightness(1, 75); // Set light 1 to 75%
// lightingController.loadScene("Evening"); // Load saved scene
// lightingController.allLightsOff(); // Turn everything off
*/