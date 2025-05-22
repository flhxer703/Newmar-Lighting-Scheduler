// server/routes/config.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const { validateConfig } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');

// Get current configuration
router.get('/', optionalAuth, async (req, res) => {
    try {
        const configFile = process.env.CONFIG_FILE || './config/settings.json';
        const data = await fs.readFile(configFile, 'utf8');
        const config = JSON.parse(data);

        // Don't send sensitive data
        const safeConfig = { ...config };
        if (!safeConfig.authentication?.remember_pin) {
            safeConfig.authentication.pin = "";
        }

        res.json({
            success: true,
            config: safeConfig
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to load configuration',
            code: 'CONFIG_LOAD_ERROR'
        });
    }
});

// Update configuration
router.post('/', validateConfig, optionalAuth, async (req, res) => {
    try {
        const configFile = process.env.CONFIG_FILE || './config/settings.json';

        // Load current config to merge
        let currentConfig = {};
        try {
            const data = await fs.readFile(configFile, 'utf8');
            currentConfig = JSON.parse(data);
        } catch (e) {
            // Use defaults if no config exists
        }

        const updatedConfig = {
            ...currentConfig,
            ...req.body,
            lastModified: new Date().toISOString()
        };

        await fs.writeFile(configFile, JSON.stringify(updatedConfig, null, 2));

        res.json({
            success: true,
            message: 'Configuration updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to save configuration',
            code: 'CONFIG_SAVE_ERROR'
        });
    }
});

// Reset configuration to defaults
router.post('/reset', optionalAuth, async (req, res) => {
    try {
        const configFile = process.env.CONFIG_FILE || './config/settings.json';

        const defaultConfig = {
            connection: {
                controller_ip: "192.168.1.100",
                controller_port: 8092,
                use_ssl: false,
                auto_connect: false,
                reconnect_attempts: 5,
                ping_interval: 30000
            },
            authentication: {
                pin: "",
                remember_pin: false,
                session_timeout: 3600000
            },
            ui: {
                theme: "default",
                show_diagnostics: true,
                default_tab: "lights",
                room_order: ["Living Room", "Kitchen", "Bedroom", "Bath", "Half Bath", "Exterior"]
            },
            scheduling: {
                enabled: true,
                check_interval: 60000,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            backup: {
                auto_backup: true,
                backup_interval: 86400000,
                max_backups: 10
            },
            advanced: {
                debug_mode: false,
                log_level: "info",
                websocket_timeout: 10000
            },
            lastModified: new Date().toISOString()
        };

        await fs.writeFile(configFile, JSON.stringify(defaultConfig, null, 2));

        res.json({
            success: true,
            message: 'Configuration reset to defaults'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to reset configuration',
            code: 'CONFIG_RESET_ERROR'
        });
    }
});

module.exports = router;

