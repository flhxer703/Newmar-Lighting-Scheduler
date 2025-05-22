const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

const CONFIG_FILE = process.env.CONFIG_FILE || './config/settings.json';
const DATA_DIR = process.env.DATA_DIR || './data';
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Default configuration
const DEFAULT_CONFIG = {
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
    }
};

// Ensure directories exist
async function ensureDirectories() {
    const configDir = path.dirname(CONFIG_FILE);
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(path.join(DATA_DIR, 'backups'), { recursive: true });
}

// Load configuration
async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (error) {
        console.log('Config file not found, creating default...');
        await saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    }
}

// Save configuration
async function saveConfig(config) {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// API Routes

// Get current configuration
app.get('/api/config', async (req, res) => {
    try {
        const config = await loadConfig();
        // Don't send PIN in response for security
        const safeConfig = { ...config };
        if (!safeConfig.authentication.remember_pin) {
            safeConfig.authentication.pin = "";
        }
        res.json(safeConfig);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update configuration
app.post('/api/config', async (req, res) => {
    try {
        const currentConfig = await loadConfig();
        const updatedConfig = { ...currentConfig, ...req.body };
        await saveConfig(updatedConfig);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get lighting data (scenes and schedules)
app.get('/api/data', async (req, res) => {
    try {
        const dataFile = path.join(DATA_DIR, 'lighting_data.json');
        const data = await fs.readFile(dataFile, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json({ scenes: [], schedules: [] });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Save lighting data
app.post('/api/data', async (req, res) => {
    try {
        const dataFile = path.join(DATA_DIR, 'lighting_data.json');
        await fs.writeFile(dataFile, JSON.stringify(req.body, null, 2));

        // Create backup if auto-backup is enabled
        const config = await loadConfig();
        if (config.backup.auto_backup) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(DATA_DIR, 'backups', `lighting_data_${timestamp}.json`);
            await fs.writeFile(backupFile, JSON.stringify(req.body, null, 2));

            // Clean old backups
            await cleanOldBackups(config.backup.max_backups);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export configuration and data
app.get('/api/export', async (req, res) => {
    try {
        const config = await loadConfig();
        const dataFile = path.join(DATA_DIR, 'lighting_data.json');
        let lightingData = { scenes: [], schedules: [] };

        try {
            const data = await fs.readFile(dataFile, 'utf8');
            lightingData = JSON.parse(data);
        } catch (e) {
            // No data file exists yet
        }

        const exportData = {
            config,
            data: lightingData,
            exportDate: new Date().toISOString(),
            version: "1.0.0"
        };

        res.setHeader('Content-Disposition', 'attachment; filename=rv-lighting-backup.json');
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Import configuration and data
app.post('/api/import', async (req, res) => {
    try {
        const importData = req.body;

        if (importData.config) {
            await saveConfig(importData.config);
        }

        if (importData.data) {
            const dataFile = path.join(DATA_DIR, 'lighting_data.json');
            await fs.writeFile(dataFile, JSON.stringify(importData.data, null, 2));
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List available backups
app.get('/api/backups', async (req, res) => {
    try {
        const backupDir = path.join(DATA_DIR, 'backups');
        const files = await fs.readdir(backupDir);
        const backups = files
            .filter(f => f.endsWith('.json'))
            .map(f => ({
                filename: f,
                date: f.replace('lighting_data_', '').replace('.json', ''),
                path: `/api/backups/${f}`
            }))
            .sort((a, b) => b.date.localeCompare(a.date));

        res.json(backups);
    } catch (error) {
        res.json([]);
    }
});

// Get specific backup
app.get('/api/backups/:filename', async (req, res) => {
    try {
        const backupFile = path.join(DATA_DIR, 'backups', req.params.filename);
        const data = await fs.readFile(backupFile, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(404).json({ error: 'Backup not found' });
    }
});

// Clean old backups
async function cleanOldBackups(maxBackups) {
    try {
        const backupDir = path.join(DATA_DIR, 'backups');
        const files = await fs.readdir(backupDir);
        const backupFiles = files
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();

        if (backupFiles.length > maxBackups) {
            const filesToDelete = backupFiles.slice(maxBackups);
            for (const file of filesToDelete) {
                await fs.unlink(path.join(backupDir, file));
            }
        }
    } catch (error) {
        console.error('Error cleaning backups:', error);
    }
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Initialize and start server
async function start() {
    try {
        await ensureDirectories();
        const config = await loadConfig();

        app.listen(PORT, () => {
            console.log(`RV Lighting Control Server running on port ${PORT}`);
            console.log(`Config file: ${CONFIG_FILE}`);
            console.log(`Data directory: ${DATA_DIR}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();