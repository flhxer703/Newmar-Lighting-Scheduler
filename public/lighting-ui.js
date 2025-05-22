
/**
 * RV Lighting Control System - UI JavaScript
 * Handles user interface interactions and WebSocket communication
 */

console.log("✅ lighting-ui.js loaded");

// Parser utilities implementation
function upad(n, targetLength = 2) {
    if (n.length > targetLength) throw new Error("target length smaller than length of n!");
    return ("0".repeat(targetLength - n.length) + n);
}

function u16toHex(value) {
    var temp1 = upad((value % 256).toString(16).toUpperCase());
    var temp2 = upad(Math.floor(value / 256).toString(16).toUpperCase());
    return temp1 + temp2;
}

function hexToU16(hex) {
    byte1 = parseInt(hex.substring(0, 2), 16);
    byte2 = parseInt(hex.substring(2, 4), 16);
    return byte1 + 256 * byte2;
}

function packEvent(...args) {
    let val = args.reduce((previous, current) => {
        return previous | current;
    });
    let hex = val.toString(16).toUpperCase();
    let phex = upad(hex, 4);
    return `0x${phex}`;
}

function ESET_INSTANCE(instance) {
    return (Math.round(instance) & 0xFF) << 8;
}

function ESET_INDEX(index) {
    return ((Math.round(index) - 1) & 0xFF) << 8;
}

function ESET_BRIGHTNESS(brightness) {
    return Math.round(brightness) & 0xFF;
}

function ESET_LEVEL(level) {
    return (Math.round(level) & 0xF);
}

function ESET_BOOLEAN(trueval, falseval) {
    return ((bool) => bool ? trueval : falseval);
}

const parserUtils = {
    ESET_INSTANCE,
    ESET_INDEX,
    ESET_BRIGHTNESS,
    ESET_LEVEL,
    ESET_TURN_ON_OFF: ESET_BOOLEAN(1, 2),
    ESET_ENABLE_DISABLE: ESET_BOOLEAN(1, 2),
    ESET_LOCK_UNLOCK: ESET_BOOLEAN(1, 0),
    packEvent,
    u16toHex,
    hexToU16,
    upad
};

// Global variables
let client = null;
let lightingController = null;
let connectionState = 'disconnected';
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectInterval = null;
let wsReady = false;
let uiUpdateInterval = null;

/**
 * WebSocket communication function
 * @param {string} data - Data to send via WebSocket
 * @param {number} attempts - Number of retry attempts
 * @returns {boolean} Success status
 */
function sendWSData(data, attempts = 0) {
    if (client && client.readyState === client.OPEN) {
        logMessage(`📤 Sending WebSocket message: ${data}`, 'info');  // <--- ADD THIS
        client.send(data);
        return true;
    } else {
        logMessage(`❌ WebSocket not ready to send: ${data}`, 'error');
        return false;
    }
}

/**
 * Connection management functions
 */
function connect() {
    const ip = document.getElementById('controller-ip').value;
    const port = document.getElementById('controller-port').value;
    const useSSL = document.getElementById('use-ssl').value === 'true';

    if (!ip || !port) {
        showAlert('Please enter IP address and port', 'danger');
        return;
    }

    updateConnectionStatus('connecting');
    logMessage(`Connecting to ${ip}:${port}...`, 'info');

    const protocol = useSSL ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${ip}:${port}/`;

    try {
        client = new WebSocket(wsUrl);

        client.onopen = function (event) {
            logMessage('WebSocket connected successfully', 'success');
            updateConnectionStatus('connected');
            reconnectAttempts = 0;
            wsReady = true;

            // Send initial handshake after short delay
            setTimeout(() => {
                sendWSData("?*!");
            }, 10);

            // Set up ping interval
            setInterval(() => {
                if (client && client.readyState === client.OPEN) {
                    sendWSData("ping");
                }
            }, 30000);
        };
        client.onmessage = function (event) {
            handleMessage(event.data);
        };

        client.onerror = function (event) {
            logMessage('WebSocket error occurred', 'error');
            updateConnectionStatus('disconnected');
        };

        client.onclose = function (event) {
            logMessage(`WebSocket closed (code: ${event.code})`, 'info');
            updateConnectionStatus('disconnected');
            wsReady = false;

            // Hide main interface if connection lost
            if (document.getElementById('main-interface').style.display !== 'none') {
                hideMainInterface();
            }

            // Attempt reconnection
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                logMessage(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`, 'info');
                setTimeout(() => connect(), 5000);
            } else {
                logMessage('Max reconnection attempts reached', 'error');
                showAlert('Connection lost. Please check your settings and try again.', 'danger');
            }
        };

    } catch (error) {
        logMessage('Failed to create WebSocket connection: ' + error.message, 'error');
        updateConnectionStatus('disconnected');
        showAlert('Failed to connect: ' + error.message, 'danger');
    }
}

function disconnect() {
    if (client) {
        client.close();
        client = null;
    }
    updateConnectionStatus('disconnected');
    wsReady = false;
    hideMainInterface();
    logMessage('Disconnected from controller', 'info');
    showAlert('Disconnected from RV controller', 'info');
}

/**
 * Message handling
 */
function handleMessage(message) {
    logMessage(`📥 Raw WebSocket message: ${message}`, 'info');
    if (window.RV_LIGHTING_DEBUG) {
        logMessage(`Message received: ${message}`, 'info');
    }

    // Handle PIN authentication messages
    if (message === "SHOWPIN" || message === "SHOWPINPAIR") {
        showPinModal();
        return;
    }

    if (message === "CORRECTPIN") {
        logMessage('PIN accepted', 'success');
        hidePinModal();
        showMainInterface();
        initializeLightingSystem();
        showAlert('PIN accepted - initializing lighting system...', 'success');
        return;
    }

    if (message === "INCORRECTPIN") {
        showPinError('Incorrect PIN entered');
        return;
    }

    if (message === "LOCKEDPIN") {
        showPinError('Too many incorrect attempts. Please wait 5 minutes.');
        return;
    }

    // Handle JSON messages
    try {
        const parsed = JSON.parse(message);
        if (window.RV_LIGHTING_DEBUG) {
            logMessage(`JSON message: ${JSON.stringify(parsed)}`, 'info');
        }
        return;
    } catch (e) {
        // Not JSON, continue processing
    }

    // Handle key=value messages
    const parts = message.split("=");
    if (parts.length > 1) {
        const event = new CustomEvent(parts[0], { detail: parts[1] });
        document.body.dispatchEvent(event);

        // Special handling for light object responses
        if (parts[0].startsWith('GET_LIGHT_OBJECT[')) {
            const event = new CustomEvent(parts[0], { detail: parts[1] });
            document.body.dispatchEvent(event);
        }
    }
}

function updateConnectionStatus(status) {
    connectionState = status;
    const statusEl = document.getElementById('connection-status');
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const websocketState = document.getElementById('websocket-state');

    statusEl.className = 'connection-status';

    switch (status) {
        case 'disconnected':
            statusEl.classList.add('status-disconnected');
            statusEl.textContent = 'Disconnected';
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            if (websocketState) websocketState.textContent = 'Closed';
            break;
        case 'connecting':
            statusEl.classList.add('status-connecting');
            statusEl.textContent = 'Connecting...';
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            if (websocketState) websocketState.textContent = 'Connecting';
            break;
        case 'connected':
            statusEl.classList.add('status-connected');
            statusEl.textContent = 'Connected';
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            if (websocketState) websocketState.textContent = 'Open';
            break;
    }
}

/**
 * PIN modal functions
 */
function showPinModal() {
    document.getElementById('pin-modal').style.display = 'block';
    document.getElementById('pin-input').focus();
}

function hidePinModal() {
    document.getElementById('pin-modal').style.display = 'none';
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-error').style.display = 'none';
}

function showPinError(message) {
    const errorEl = document.getElementById('pin-error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function submitPin() {
    const pin = document.getElementById('pin-input').value;
    if (pin.length < 4) {
        showPinError('PIN must be at least 4 digits');
        return;
    }

    logMessage(`Submitting PIN: ${'*'.repeat(pin.length)}`, 'info');
    sendWSData(`PIN=${pin}`);

    // Store PIN for reconnection
    sessionStorage.setItem('enteredPin', pin);
}

/**
 * Interface management
 */
function showMainInterface() {
    document.getElementById('connection-panel').style.display = 'none';
    document.getElementById('main-interface').style.display = 'block';

    // Start UI update interval
    if (!uiUpdateInterval) {
        uiUpdateInterval = setInterval(updateUI, 1000);
    }
}

function hideMainInterface() {
    document.getElementById('connection-panel').style.display = 'block';
    document.getElementById('main-interface').style.display = 'none';

    // Stop UI update interval
    if (uiUpdateInterval) {
        clearInterval(uiUpdateInterval);
        uiUpdateInterval = null;
    }
}

/**
 * Initialize lighting system
 */
function initializeLightingSystem() {
    if (!window.RVLightingController) {
        logMessage('RVLightingController class not available', 'error');
        showAlert('Lighting controller not available. Please check installation.', 'danger');
        return;
    }

    lightingController = new RVLightingController();
    lightingController.setDebug(window.RV_LIGHTING_DEBUG || false);

    lightingController.initialize().then(() => {
        logMessage('Lighting system initialized successfully', 'success');
        showAlert('Lighting system connected and ready!', 'success');
        updateSystemStatus();
        displayLights();
        displayScenes();
        displaySchedules();
    }).catch(error => {
        logMessage('Failed to initialize lighting system: ' + error.message, 'error');
        showAlert('Failed to initialize lighting system: ' + error.message, 'danger');
    });
}

/**
 * UI Functions
 */
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');

    // Update tab-specific content
    switch (tabName) {
        case 'lights':
            displayLights();
            break;
        case 'scenes':
            displayScenes();
            break;
        case 'schedules':
            displaySchedules();
            break;
        case 'diagnostics':
            updateSystemStatus();
            break;
    }
}

function setLightBrightness(lightIndex, brightness) {
    if (lightingController) {
        lightingController.setLightBrightness(lightIndex, parseInt(brightness));

        // Update UI
        const lightControl = event.target.closest('.light-control');
        if (lightControl) {
            const toggleBtn = lightControl.querySelector('.light-toggle');
            if (toggleBtn) {
                if (brightness > 0) {
                    toggleBtn.textContent = 'ON';
                    toggleBtn.className = 'light-toggle on';
                } else {
                    toggleBtn.textContent = 'OFF';
                    toggleBtn.className = 'light-toggle off';
                }
            }
        }
    }
}

function toggleLight(lightIndex, button) {
    if (!lightingController) return;

    const isOn = button.classList.contains('on');
    const newState = !isOn;

    lightingController.toggleLight(lightIndex, newState);

    // Update UI
    const lightControl = button.closest('.light-control');
    const slider = lightControl.querySelector('.light-brightness');

    if (newState) {
        button.textContent = 'ON';
        button.className = 'light-toggle on';
        if (slider) slider.value = 100;
    } else {
        button.textContent = 'OFF';
        button.className = 'light-toggle off';
        if (slider) slider.value = 0;
    }
}

function allLightsOn() {
    if (lightingController) {
        lightingController.allLightsOn();
        updateLightUI();
        showAlert('All lights turned on', 'success');
    }
}

function allLightsOff() {
    if (lightingController) {
        lightingController.allLightsOff();
        updateLightUI();
        showAlert('All lights turned off', 'success');
    }
}

function updateLightUI() {
    // Update all UI elements to reflect current state
    document.querySelectorAll('.light-brightness').forEach(slider => {
        const lightIndex = parseInt(slider.dataset.lightIndex);
        if (lightingController && lightingController.lights.has(lightIndex)) {
            const light = lightingController.lights.get(lightIndex);
            slider.value = light.currentBrightness;
        }
    });

    document.querySelectorAll('.light-toggle').forEach(btn => {
        const lightIndex = parseInt(btn.dataset.lightIndex);
        if (lightingController && lightingController.lights.has(lightIndex)) {
            const light = lightingController.lights.get(lightIndex);
            if (light.currentBrightness > 0) {
                btn.textContent = 'ON';
                btn.className = 'light-toggle on';
            } else {
                btn.textContent = 'OFF';
                btn.className = 'light-toggle off';
            }
        }
    });
}

function saveCurrentScene() {
    const sceneName = prompt('Enter scene name:');
    if (sceneName && lightingController) {
        lightingController.saveScene(sceneName).then((success) => {
            if (success) {
                showAlert(`Scene "${sceneName}" saved successfully!`, 'success');
                displayScenes();
            } else {
                showAlert(`Failed to save scene "${sceneName}"`, 'danger');
            }
        });
    }
}

function createScene() {
    const name = document.getElementById('new-scene-name').value;
    const roomFilter = document.getElementById('scene-room-filter').value;

    if (!name) {
        showAlert('Please enter a scene name', 'warning');
        return;
    }

    if (lightingController) {
        const roomId = roomFilter ? parseInt(roomFilter) : null;
        lightingController.saveScene(name, roomId).then((success) => {
            if (success) {
                showAlert(`Scene "${name}" created successfully!`, 'success');
                document.getElementById('new-scene-name').value = '';
                document.getElementById('scene-room-filter').value = '';
                displayScenes();
            } else {
                showAlert(`Failed to create scene "${name}"`, 'danger');
            }
        });
    }
}

function loadScene(sceneName) {
    if (lightingController) {
        const success = lightingController.loadScene(sceneName);
        if (success) {
            showAlert(`Scene "${sceneName}" loaded!`, 'success');
            updateLightUI();
        } else {
            showAlert(`Failed to load scene "${sceneName}"`, 'danger');
        }
    }
}

function deleteScene(sceneName) {
    if (confirm(`Delete scene "${sceneName}"?`)) {
        if (lightingController) {
            const success = lightingController.deleteScene(sceneName);
            if (success) {
                showAlert(`Scene "${sceneName}" deleted!`, 'success');
                displayScenes();
            } else {
                showAlert(`Failed to delete scene "${sceneName}"`, 'danger');
            }
        }
    }
}

function createSchedule() {
    const name = document.getElementById('new-schedule-name').value;
    if (!name) {
        showAlert('Please enter a schedule name', 'warning');
        return;
    }

    // For now, create a simple daily schedule
    // TODO: Implement schedule creation modal
    const events = [
        {
            time: "07:00",
            days: ["mon", "tue", "wed", "thu", "fri"],
            action: "lights_on"
        },
        {
            time: "22:00",
            days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
            action: "lights_off"
        }
    ];

    if (lightingController) {
        const success = lightingController.createSchedule(name, events);
        if (success) {
            showAlert(`Schedule "${name}" created!`, 'success');
            document.getElementById('new-schedule-name').value = '';
            displaySchedules();
        } else {
            showAlert(`Failed to create schedule "${name}"`, 'danger');
        }
    }
}

function activateSchedule(scheduleName) {
    if (lightingController) {
        const success = lightingController.activateSchedule(scheduleName);
        if (success) {
            showAlert(`Schedule "${scheduleName}" activated!`, 'success');
            displaySchedules();
        } else {
            showAlert(`Failed to activate schedule "${scheduleName}"`, 'danger');
        }
    }
}

function deactivateSchedule(scheduleName) {
    if (lightingController) {
        const success = lightingController.deactivateSchedule(scheduleName);
        if (success) {
            showAlert(`Schedule "${scheduleName}" deactivated!`, 'success');
            displaySchedules();
        } else {
            showAlert(`Failed to deactivate schedule "${scheduleName}"`, 'danger');
        }
    }
}

function deleteSchedule(scheduleName) {
    if (confirm(`Delete schedule "${scheduleName}"?`)) {
        if (lightingController) {
            lightingController.schedules.delete(scheduleName);
            lightingController.deactivateSchedule(scheduleName);
            lightingController.saveToStorage();
            showAlert(`Schedule "${scheduleName}" deleted!`, 'success');
            displaySchedules();
        }
    }
}

function refreshLights() {
    if (lightingController) {
        lightingController.initialize().then(() => {
            showAlert('Lights refreshed successfully!', 'success');
            displayLights();
            updateSystemStatus();
        }).catch(error => {
            showAlert('Failed to refresh lights: ' + error.message, 'danger');
        });
    }
}

function sendManualCommand() {
    const command = document.getElementById('manual-command').value;
    if (command && sendWSData(command)) {
        logMessage(`Manual command sent: ${command}`, 'info');
        document.getElementById('manual-command').value = '';
        showAlert('Command sent successfully', 'success');
    } else {
        showAlert('Failed to send command', 'danger');
    }
}

/**
 * Display functions
 */
function displayLights() {
    if (!lightingController || !lightingController.isInitialized) {
        return;
    }

    const container = document.getElementById('room-lights-container');
    const roomsMap = {};

    // Group lights by room
    lightingController.getAllLights().forEach(light => {
        if (!roomsMap[light.roomName]) {
            roomsMap[light.roomName] = [];
        }
        roomsMap[light.roomName].push(light);
    });

    // Create HTML for each room
    let html = '';
    Object.keys(roomsMap).forEach(roomName => {
        const roomLights = roomsMap[roomName];
        html += `
            <div class="room-lights">
                <div class="room-header">
                    ${roomName}
                    <span class="room-light-count">${roomLights.length} light${roomLights.length !== 1 ? 's' : ''}</span>
                </div>
                ${roomLights.map(light => `
                    <div class="light-control">
                        <span class="light-name">${light.name}</span>
                        ${light.isDimmer ?
                `<input type="range" class="light-brightness" min="0" max="100" value="${light.currentBrightness}" 
                             data-light-index="${light.index}"
                             onchange="setLightBrightness(${light.index}, this.value)">` :
                ''
            }
                        <button class="light-toggle ${light.currentBrightness > 0 ? 'on' : 'off'}" 
                                data-light-index="${light.index}"
                                onclick="toggleLight(${light.index}, this)">
                            ${light.currentBrightness > 0 ? 'ON' : 'OFF'}
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    });

    container.innerHTML = html || '<div class="alert alert-warning">No lights discovered yet</div>';
}

function displayScenes() {
    if (!lightingController) return;

    const container = document.getElementById('scenes-list');
    const scenes = lightingController.getAllScenes();

    let html = '';
    scenes.forEach(scene => {
        const date = new Date(scene.created).toLocaleDateString();
        const roomText = scene.room !== null ? ` • ${lightingController.roomNames[scene.room]}` : '';
        html += `
            <div class="scene-item">
                <div class="scene-info">
                    <h4>${scene.name}</h4>
                    <p>Created: ${date} • ${scene.lights.length} lights${roomText}</p>
                </div>
                <div class="scene-actions">
                    <button class="btn btn-primary" onclick="loadScene('${scene.name}')">Load</button>
                    <button class="btn btn-danger" onclick="deleteScene('${scene.name}')">Delete</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html || '<div class="alert alert-warning">No scenes saved yet</div>';
}

function displaySchedules() {
    if (!lightingController) return;

    const container = document.getElementById('schedules-list');
    const schedules = Array.from(lightingController.schedules.values());

    let html = '';
    schedules.forEach(schedule => {
        const date = new Date(schedule.created).toLocaleDateString();
        const isActive = lightingController.activeSchedules.has(schedule.name);
        const statusClass = isActive ? 'active' : 'inactive';
        const statusText = isActive ? 'Active' : 'Inactive';

        html += `
            <div class="schedule-item ${schedule.enabled ? '' : 'disabled'}">
                <div class="schedule-info">
                    <h4>${schedule.name}
                        <span class="schedule-status ${statusClass}">${statusText}</span>
                    </h4>
                    <p>Created: ${date} • ${schedule.events.length} events</p>
                </div>
                <div class="schedule-actions">
                    ${isActive ?
                `<button class="btn btn-warning" onclick="deactivateSchedule('${schedule.name}')">Deactivate</button>` :
                `<button class="btn btn-success" onclick="activateSchedule('${schedule.name}')">Activate</button>`
            }
                    <button class="btn btn-danger" onclick="deleteSchedule('${schedule.name}')">Delete</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html || '<div class="alert alert-warning">No schedules created yet</div>';
}

function updateSystemStatus() {
    if (!lightingController) return;

    const status = lightingController.getStatus();

    document.getElementById('lights-count').textContent = status.lightsCount;
    document.getElementById('controller-status').textContent = status.initialized ? 'Connected' : 'Disconnected';
    document.getElementById('active-schedules-count').textContent = status.activeSchedulesCount;
}

function updateUI() {
    // Periodic UI updates
    if (lightingController && lightingController.isInitialized) {
        updateSystemStatus();
    }
}

/**
 * Import/Export functions
 */
function exportConfig() {
    if (!lightingController) {
        showAlert('Lighting controller not initialized', 'warning');
        return;
    }

    const config = lightingController.exportConfig();
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `rv-lighting-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    showAlert('Configuration exported successfully', 'success');
}

function importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const config = JSON.parse(e.target.result);
                if (lightingController && lightingController.importConfig(config)) {
                    showAlert('Configuration imported successfully', 'success');
                    displayScenes();
                    displaySchedules();
                } else {
                    showAlert('Failed to import configuration', 'danger');
                }
            } catch (error) {
                showAlert('Invalid configuration file', 'danger');
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

/**
 * Utility functions
 */
function logMessage(message, type = 'info') {
    const logsContainer = document.getElementById('connection-logs') || document.getElementById('system-logs');
    if (!logsContainer) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;

    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Keep only last 100 entries
    const entries = logsContainer.querySelectorAll('.log-entry');
    if (entries.length > 100) {
        entries[0].remove();
    }
}

function showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('connection-alerts');
    if (!alertsContainer) {
        // Fallback to console if no alerts container
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} fade-in`;
    alert.textContent = message;

    alertsContainer.appendChild(alert);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.style.opacity = '0';
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 300);
        }
    }, 5000);
}

/**
 * Event listeners and initialization
 */
// PATCHED lighting-ui.js

// (Preserves original working code)
// Adds DOMContentLoaded registration for manual command submission

// -- snip: original content retained above --

/**
 * Event listeners and initialization
 */
document.addEventListener('DOMContentLoaded', function () {
    // Connection buttons
    document.getElementById('connect-btn').addEventListener('click', connect);
    document.getElementById('disconnect-btn').addEventListener('click', disconnect);

    // PIN modal
    document.getElementById('pin-submit').addEventListener('click', submitPin);
    document.getElementById('pin-cancel').addEventListener('click', hidePinModal);

    // PIN input Enter key
    document.getElementById('pin-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            submitPin();
        }
    });

    // Manual command form handler (patch begins)
    const diagnosticsForm = document.querySelector('#diagnostics form');
    if (diagnosticsForm) {
        diagnosticsForm.addEventListener('submit', function (e) {
            e.preventDefault();
            sendManualCommand();
        });
    }

    // Scene name Enter key
    document.getElementById('new-scene-name').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            createScene();
        }
    });

    // Schedule name Enter key
    document.getElementById('new-schedule-name').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            createSchedule();
        }
    });

    // Load saved connection settings
    const savedIP = localStorage.getItem('rv_controller_ip');
    const savedPort = localStorage.getItem('rv_controller_port');
    const savedSSL = localStorage.getItem('rv_controller_ssl');

    if (savedIP) document.getElementById('controller-ip').value = savedIP;
    if (savedPort) document.getElementById('controller-port').value = savedPort;
    if (savedSSL) document.getElementById('use-ssl').value = savedSSL;

    // Save connection settings on change
    document.getElementById('controller-ip').addEventListener('change', function () {
        localStorage.setItem('rv_controller_ip', this.value);
    });
    document.getElementById('controller-port').addEventListener('change', function () {
        localStorage.setItem('rv_controller_port', this.value);
    });
    document.getElementById('use-ssl').addEventListener('change', function () {
        localStorage.setItem('rv_controller_ssl', this.value);
    });

    // Auto-reconnect with stored PIN
    const storedPin = sessionStorage.getItem('enteredPin');
    if (storedPin && savedIP && savedPort) {
        // Auto-connect if we have stored credentials
        setTimeout(() => {
            if (connectionState === 'disconnected') {
                connect();
            }
        }, 1000);
    }

    logMessage('RV Lighting Control System ready', 'success');
});

// -- snip: the rest remains unchanged --


// Handle page unload
window.addEventListener('beforeunload', function () {
    if (client) {
        client.close();
    }
    if (lightingController) {
        lightingController.cleanup();
    }
    if (uiUpdateInterval) {
        clearInterval(uiUpdateInterval);
    }
});

// Global error handler
window.addEventListener('error', function (event) {
    logMessage(`JavaScript error: ${event.error.message}`, 'error');
});

// Expose functions globally for onclick handlers
window.showTab = showTab;
window.setLightBrightness = setLightBrightness;
window.toggleLight = toggleLight;
window.allLightsOn = allLightsOn;
window.allLightsOff = allLightsOff;
window.saveCurrentScene = saveCurrentScene;
window.createScene = createScene;
window.loadScene = loadScene;
window.deleteScene = deleteScene;
window.createSchedule = createSchedule;
window.activateSchedule = activateSchedule;
window.deactivateSchedule = deactivateSchedule;
window.deleteSchedule = deleteSchedule;
window.refreshLights = refreshLights;
window.sendManualCommand = sendManualCommand;
window.exportConfig = exportConfig;
window.importConfig = importConfig;