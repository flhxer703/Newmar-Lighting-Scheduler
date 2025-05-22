/**
 * RV Lighting Scenes & Schedules System
 * Main Controller Class
 * 
 * @author RV Lighting Team
 * @version 1.0.0
 * @description Compatible with Newmar 2024 Lighting System
 * @requires WebSocket connection (sendWSData function) and parserUtils
 */

class RVLightingController {
    /**
     * Create a new RV Lighting Controller
     * @constructor
     */
    constructor() {
        this.lights = new Map();
        this.scenes = new Map();
        this.schedules = new Map();
        this.activeSchedules = new Set();
        this.scheduleIntervals = new Map();
        this.isInitialized = false;
        this.debug = false;

        // Room definitions based on Newmar system
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

        // Event handlers
        this.eventHandlers = new Map();

        // Load saved data from localStorage
        this.loadSavedData();

        this.log("RV Lighting Controller instantiated");
    }

    /**
     * Initialize the lighting system by discovering all lights
     * @returns {Promise<Map>} Promise that resolves to discovered lights map
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.log("Initializing RV Lighting Controller...");

            // Check dependencies
            if (typeof sendWSData === 'undefined') {
                reject(new Error("sendWSData function not available"));
                return;
            }

            if (typeof parserUtils === 'undefined') {
                reject(new Error("parserUtils object not available"));
                return;
            }

            // Set up event listener for light count
            const lightCountHandler = (e, count) => {
                this.log(`Discovered ${count} lights`);
                let receivedCount = 0;
                const totalLights = parseInt(count);

                if (totalLights === 0) {
                    this.isInitialized = true;
                    this.log("No lights found, but system initialized");
                    resolve(this.lights);
                    return;
                }

                // Get each light object
                for (let i = 0; i < totalLights; i++) {
                    const lightObjectHandler = (e, objectString) => {
                        try {
                            const lightObject = JSON.parse(objectString);

                            // Store light info
                            const lightData = {
                                name: lightObject.name.replace(/\|/g, " "),
                                index: lightObject.index,
                                instance: lightObject.instance,
                                command: lightObject.command,
                                room: lightObject.room_loc,
                                roomName: this.roomNames[lightObject.room_loc] || "Unknown",
                                isDimmer: parseInt(lightObject.command) === 0,
                                currentBrightness: 0
                            };

                            this.lights.set(lightObject.index, lightData);
                            this.log(`Light ${i}: ${lightData.name} (Room: ${lightData.roomName})`);

                            receivedCount++;
                            if (receivedCount === totalLights) {
                                this.isInitialized = true;
                                this.log("Lighting controller initialized successfully");
                                resolve(this.lights);
                            }
                        } catch (error) {
                            this.error(`Error parsing light object ${i}:`, error);
                        }
                    };

                    // Set up individual light object listener
                    this.addEventHandler(`GET_LIGHT_OBJECT[${i}]`, lightObjectHandler, true);
                    sendWSData(`GET_LIGHT_OBJECT[${i}]`);
                }
            };

            // Set up light count listener
            this.addEventHandler('GET_LIGHT_COUNT', lightCountHandler, true);

            // Request light count to start discovery
            sendWSData("GET_LIGHT_COUNT");

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.isInitialized) {
                    this.error("Lighting system initialization timeout");
                    reject(new Error("INIT_TIMEOUT"));
                }
            }, 10000);
        });
    }

    /**
     * Add event handler with optional auto-cleanup
     * @private
     */
    addEventHandler(eventName, handler, once = false) {
        if (typeof $ !== 'undefined') {
            const $handler = once ?
                $('body').one(eventName, handler) :
                $('body').on(eventName, handler);

            if (!once) {
                this.eventHandlers.set(eventName, handler);
            }
        } else {
            // Fallback for environments without jQuery
            const customHandler = (e) => handler(e, e.detail);
            document.body.addEventListener(eventName, customHandler, { once });

            if (!once) {
                this.eventHandlers.set(eventName, customHandler);
            }
        }
    }

    /**
     * Clean up event handlers
     * @private
     */
    cleanup() {
        this.eventHandlers.forEach((handler, eventName) => {
            if (typeof $ !== 'undefined') {
                $('body').off(eventName, handler);
            } else {
                document.body.removeEventListener(eventName, handler);
            }
        });
        this.eventHandlers.clear();

        // Clear schedule intervals
        this.scheduleIntervals.forEach(intervalId => clearInterval(intervalId));
        this.scheduleIntervals.clear();
        this.activeSchedules.clear();
    }

    /**
     * Get all available lights
     * @returns {Array} Array of light objects
     */
    getAllLights() {
        return Array.from(this.lights.values());
    }

    /**
     * Get lights by room
     * @param {number} roomId - Room ID (0-5)
     * @returns {Array} Array of lights in the specified room
     */
    getLightsByRoom(roomId) {
        return this.getAllLights().filter(light => light.room === roomId);
    }

    /**
     * Set brightness for a specific light
     * @param {number} lightIndex - Light index from discovery
     * @param {number} brightness - Brightness level 0-100
     * @returns {boolean} Success status
     */
    setLightBrightness(lightIndex, brightness) {
        const light = this.lights.get(lightIndex);
        if (!light) {
            this.error(`Light ${lightIndex} not found`);
            return false;
        }

        // Clamp brightness to 0-100
        brightness = Math.max(0, Math.min(100, brightness));

        try {
            if (light.isDimmer) {
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
            this.log(`Set ${light.name} to ${brightness}%`);
            return true;
        } catch (error) {
            this.error(`Failed to set brightness for light ${lightIndex}:`, error);
            return false;
        }
    }

    /**
     * Toggle light on/off
     * @param {number} lightIndex - Light index
     * @param {boolean|null} state - Desired state (null to toggle current)
     * @returns {boolean} Success status
     */
    toggleLight(lightIndex, state = null) {
        const light = this.lights.get(lightIndex);
        if (!light) return false;

        if (state === null) {
            // Toggle current state
            state = light.currentBrightness === 0;
        }

        const brightness = state ? 100 : 0;
        return this.setLightBrightness(lightIndex, brightness);
    }

    /**
     * Save current light states as a scene
     * @param {string} sceneName - Name for the scene
     * @param {number|null} roomFilter - Room ID to filter by (null for all rooms)
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    async saveScene(sceneName, roomFilter = null) {
        if (!this.isInitialized) {
            this.error("Lighting controller not initialized");
            return false;
        }

        if (!sceneName || typeof sceneName !== 'string') {
            this.error("Invalid scene name provided");
            return false;
        }

        try {
            // Get current brightness levels for all lights
            const lightStates = [];

            for (const light of this.lights.values()) {
                if (roomFilter !== null && light.room !== roomFilter) continue;

                // Request current brightness if possible
                await this.getCurrentBrightness(light.index).catch(() => {
                    // If we can't get current brightness, use stored value
                    this.log(`Using stored brightness for ${light.name}`);
                });

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

            this.log(`Scene "${sceneName}" saved with ${lightStates.length} lights`);
            return true;
        } catch (error) {
            this.error(`Failed to save scene "${sceneName}":`, error);
            return false;
        }
    }

    /**
     * Load and activate a scene
     * @param {string} sceneName - Name of scene to load
     * @returns {boolean} Success status
     */
    loadScene(sceneName) {
        const scene = this.scenes.get(sceneName);
        if (!scene) {
            this.error(`Scene "${sceneName}" not found`);
            return false;
        }

        this.log(`Loading scene: ${sceneName}`);

        try {
            // Apply each light setting
            let successCount = 0;
            for (const lightState of scene.lights) {
                if (this.setLightBrightness(lightState.index, lightState.brightness)) {
                    successCount++;
                }
            }

            this.log(`Scene loaded: ${successCount}/${scene.lights.length} lights set successfully`);
            return successCount > 0;
        } catch (error) {
            this.error(`Failed to load scene "${sceneName}":`, error);
            return false;
        }
    }

    /**
     * Delete a scene
     * @param {string} sceneName - Name of scene to delete
     * @returns {boolean} Success status
     */
    deleteScene(sceneName) {
        if (this.scenes.delete(sceneName)) {
            this.saveToStorage();
            this.log(`Scene "${sceneName}" deleted`);
            return true;
        }
        this.error(`Scene "${sceneName}" not found for deletion`);
        return false;
    }

    /**
     * Get all saved scenes
     * @returns {Array} Array of scene objects
     */
    getAllScenes() {
        return Array.from(this.scenes.values());
    }

    /**
     * Create a lighting schedule
     * @param {string} scheduleName - Name for the schedule
     * @param {Array} events - Array of schedule event objects
     * @returns {boolean} Success status
     */
    createSchedule(scheduleName, events) {
        if (!scheduleName || !Array.isArray(events)) {
            this.error("Invalid schedule parameters");
            return false;
        }

        try {
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

            this.log(`Schedule "${scheduleName}" created with ${events.length} events`);
            return true;
        } catch (error) {
            this.error(`Failed to create schedule "${scheduleName}":`, error);
            return false;
        }
    }

    /**
     * Activate a schedule
     * @param {string} scheduleName - Name of schedule to activate
     * @returns {boolean} Success status
     */
    activateSchedule(scheduleName) {
        const schedule = this.schedules.get(scheduleName);
        if (!schedule) {
            this.error(`Schedule "${scheduleName}" not found`);
            return false;
        }

        if (this.activeSchedules.has(scheduleName)) {
            this.log(`Schedule "${scheduleName}" already active`);
            return true;
        }

        this.activeSchedules.add(scheduleName);

        // Set up interval to check schedule every minute
        const intervalId = setInterval(() => {
            this.checkScheduleEvents(scheduleName);
        }, 60000); // Check every minute

        this.scheduleIntervals.set(scheduleName, intervalId);

        this.log(`Schedule "${scheduleName}" activated`);
        return true;
    }

    /**
     * Deactivate a schedule
     * @param {string} scheduleName - Name of schedule to deactivate
     * @returns {boolean} Success status
     */
    deactivateSchedule(scheduleName) {
        if (!this.activeSchedules.has(scheduleName)) {
            return false;
        }

        const intervalId = this.scheduleIntervals.get(scheduleName);
        if (intervalId) {
            clearInterval(intervalId);
            this.scheduleIntervals.delete(scheduleName);
        }

        this.activeSchedules.delete(scheduleName);
        this.log(`Schedule "${scheduleName}" deactivated`);
        return true;
    }

    /**
     * Check if any scheduled events should trigger
     * @private
     * @param {string} scheduleName - Name of schedule to check
     */
    checkScheduleEvents(scheduleName) {
        const schedule = this.schedules.get(scheduleName);
        if (!schedule || !schedule.enabled) return;

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];

        for (const event of schedule.events) {
            if (event.time === currentTime && event.days.includes(currentDay)) {
                this.log(`Triggering scheduled event: ${event.action} at ${currentTime}`);

                switch (event.action) {
                    case 'load_scene':
                        if (event.scene) {
                            this.loadScene(event.scene);
                        }
                        break;
                    case 'lights_off':
                        this.allLightsOff();
                        break;
                    case 'lights_on':
                        this.allLightsOn();
                        break;
                    default:
                        this.error(`Unknown schedule action: ${event.action}`);
                }
            }
        }
    }

    /**
     * Turn all lights off
     */
    allLightsOff() {
        let count = 0;
        for (const light of this.lights.values()) {
            if (this.setLightBrightness(light.index, 0)) {
                count++;
            }
        }
        this.log(`All lights turned off (${count}/${this.lights.size} successful)`);
    }

    /**
     * Turn all lights on
     */
    allLightsOn() {
        let count = 0;
        for (const light of this.lights.values()) {
            if (this.setLightBrightness(light.index, 100)) {
                count++;
            }
        }
        this.log(`All lights turned on (${count}/${this.lights.size} successful)`);
    }

    /**
     * Get current brightness for a light
     * @private
     * @param {number} lightIndex - Light index
     * @returns {Promise<number>} Promise resolving to brightness level
     */
    async getCurrentBrightness(lightIndex) {
        return new Promise((resolve, reject) => {
            const eventName = `NEWMAR_DIMMER_BRIGHTNESS[${lightIndex}]`;
            const timeout = setTimeout(() => {
                reject(new Error("Brightness request timeout"));
            }, 5000);

            const handler = (e, brightness) => {
                clearTimeout(timeout);
                try {
                    const level = parseInt(brightness.toString().replace("%", ""));
                    const light = this.lights.get(lightIndex);
                    if (light) {
                        light.currentBrightness = level;
                    }
                    resolve(level);
                } catch (error) {
                    reject(error);
                }
            };

            this.addEventHandler(eventName, handler, true);
            sendWSData(`NEWMAR_DIMMER_BRIGHTNESS[${lightIndex}]`);
        });
    }

    /**
     * Save data to localStorage
     * @private
     */
    saveToStorage() {
        try {
            const data = {
                scenes: Array.from(this.scenes.entries()),
                schedules: Array.from(this.schedules.entries()),
                version: "1.0.0",
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem('rv_lighting_data', JSON.stringify(data));
            this.log("Data saved to localStorage");
        } catch (error) {
            this.error("Failed to save data to localStorage:", error);
        }
    }

    /**
     * Load data from localStorage
     * @private
     */
    loadSavedData() {
        try {
            const data = JSON.parse(localStorage.getItem('rv_lighting_data') || '{}');

            if (data.scenes) {
                this.scenes = new Map(data.scenes);
            }

            if (data.schedules) {
                this.schedules = new Map(data.schedules);
            }

            this.log(`Loaded ${this.scenes.size} scenes and ${this.schedules.size} schedules`);
        } catch (error) {
            this.error("Error loading saved lighting data:", error);
        }
    }

    /**
     * Export configuration
     * @returns {Object} Configuration object
     */
    exportConfig() {
        return {
            scenes: this.getAllScenes(),
            schedules: Array.from(this.schedules.values()),
            version: "1.0.0",
            exportDate: new Date().toISOString(),
            lights: this.getAllLights().map(light => ({
                name: light.name,
                room: light.room,
                roomName: light.roomName,
                isDimmer: light.isDimmer
            }))
        };
    }

    /**
     * Import configuration
     * @param {Object} config - Configuration object to import
     * @returns {boolean} Success status
     */
    importConfig(config) {
        try {
            if (!config || typeof config !== 'object') {
                throw new Error("Invalid configuration object");
            }

            let importedScenes = 0;
            let importedSchedules = 0;

            if (config.scenes && Array.isArray(config.scenes)) {
                for (const scene of config.scenes) {
                    if (scene.name) {
                        this.scenes.set(scene.name, scene);
                        importedScenes++;
                    }
                }
            }

            if (config.schedules && Array.isArray(config.schedules)) {
                for (const schedule of config.schedules) {
                    if (schedule.name) {
                        this.schedules.set(schedule.name, schedule);
                        importedSchedules++;
                    }
                }
            }

            this.saveToStorage();
            this.log(`Configuration imported: ${importedScenes} scenes, ${importedSchedules} schedules`);
            return true;
        } catch (error) {
            this.error("Error importing configuration:", error);
            return false;
        }
    }

    /**
     * Get system status
     * @returns {Object} System status object
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            lightsCount: this.lights.size,
            scenesCount: this.scenes.size,
            schedulesCount: this.schedules.size,
            activeSchedulesCount: this.activeSchedules.size,
            rooms: Object.keys(this.roomNames).map(id => ({
                id: parseInt(id),
                name: this.roomNames[id],
                lightCount: this.getLightsByRoom(parseInt(id)).length
            }))
        };
    }

    /**
     * Enable debug logging
     * @param {boolean} enabled - Whether to enable debug logging
     */
    setDebug(enabled) {
        this.debug = !!enabled;
        this.log(`Debug logging ${this.debug ? 'enabled' : 'disabled'}`);
    }

    /**
     * Log a message (respects debug setting)
     * @private
     */
    log(message, ...args) {
        if (this.debug || window.RV_LIGHTING_DEBUG) {
            console.log(`[RVLighting] ${message}`, ...args);
        }
    }

    /**
     * Log an error (always shown)
     * @private
     */
    error(message, ...args) {
        console.error(`[RVLighting] ${message}`, ...args);
    }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RVLightingController;
} else if (typeof window !== 'undefined') {
    window.RVLightingController = RVLightingController;
}