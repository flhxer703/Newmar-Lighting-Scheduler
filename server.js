// const express = require('express');
// const fs = require('fs').promises;
// const path = require('path');
// const app = express();

// const CONFIG_FILE = process.env.CONFIG_FILE || './config/settings.json';
// const DATA_DIR = process.env.DATA_DIR || './data';
// const PORT = process.env.PORT || 3000;

// const { validateConfig } = require('./server/middleware/validation');

// app.use(express.json());
// app.use(express.static('public'));

// console.log("🚀 RV Lighting Control Server starting...");

// // Ensure directories exist
// async function ensureDirectories() {
//     const configDir = path.dirname(CONFIG_FILE);
//     await fs.mkdir(configDir, { recursive: true });
//     await fs.mkdir(DATA_DIR, { recursive: true });
//     await fs.mkdir(path.join(DATA_DIR, 'backups'), { recursive: true });
// }

// // Load configuration from disk
// async function loadConfig() {
//     try {
//         const data = await fs.readFile(CONFIG_FILE, 'utf8');
//         return JSON.parse(data);
//     } catch (error) {
//         console.log('⚠️ Config file not found or invalid. Using empty config.');
//         return {};
//     }
// }

// // Save configuration to disk
// async function saveConfig(config) {
//     await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
// }

// app.post('/api/config', validateConfig, async (req, res) => {
//     try {
//         const currentConfig = await loadConfig();
//         const updatedConfig = { ...currentConfig, ...req.body };
//         await saveConfig(updatedConfig);
//         res.json({ success: true });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// // Start server
// ensureDirectories().then(() => {
//     app.listen(PORT, () => {
//         console.log(`✅ Server is running at http://localhost:${PORT}`);
//     });
// }).catch(err => {
//     console.error('❌ Failed to initialize server:', err);
//     process.exit(1);
// });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Environment configuration
const CONFIG_FILE = process.env.CONFIG_FILE || './config/settings.json';
const DATA_DIR = process.env.DATA_DIR || './data';
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log("🚀 RV Lighting Control Server starting...");

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", "ws:", "wss:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP' }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use(express.static('public', {
    maxAge: NODE_ENV === 'production' ? '1y' : '0',
    etag: true
}));

// Ensure directories exist
async function ensureDirectories() {
    try {
        const configDir = path.dirname(CONFIG_FILE);
        await fs.mkdir(configDir, { recursive: true });
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.mkdir(path.join(DATA_DIR, 'backups'), { recursive: true });
        console.log("📁 Directories created/verified");
    } catch (error) {
        console.error("❌ Failed to create directories:", error);
        throw error;
    }
}

// Load configuration from disk
async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('⚠️ Config file not found. Creating default config.');
            const defaultConfig = createDefaultConfig();
            await saveConfig(defaultConfig);
            return defaultConfig;
        }
        console.error('❌ Error loading config:', error);
        return createDefaultConfig();
    }
}

// Save configuration to disk
async function saveConfig(config) {
    try {
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log("💾 Configuration saved");
    } catch (error) {
        console.error("❌ Failed to save config:", error);
        throw error;
    }
}

// Create default configuration
function createDefaultConfig() {
    return {
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
            timezone: "America/New_York"
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
}

// Basic validation middleware
function validateConfig(req, res, next) {
    const config = req.body;

    // Basic validation
    if (!config || typeof config !== 'object') {
        return res.status(400).json({
            error: 'Invalid configuration object',
            code: 'VALIDATION_ERROR'
        });
    }

    next();
}

// Optional auth middleware (placeholder)
function optionalAuth(req, res, next) {
    // For now, just pass through
    // In production, implement proper session/token validation
    next();
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Configuration routes
app.get('/api/config', optionalAuth, async (req, res) => {
    try {
        const config = await loadConfig();

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
        console.error('Config load error:', error);
        res.status(500).json({
            error: 'Failed to load configuration',
            code: 'CONFIG_LOAD_ERROR'
        });
    }
});

app.post('/api/config', validateConfig, optionalAuth, async (req, res) => {
    try {
        const currentConfig = await loadConfig();
        const updatedConfig = {
            ...currentConfig,
            ...req.body,
            lastModified: new Date().toISOString()
        };

        await saveConfig(updatedConfig);

        res.json({
            success: true,
            message: 'Configuration updated successfully'
        });
    } catch (error) {
        console.error('Config save error:', error);
        res.status(500).json({
            error: 'Failed to save configuration',
            code: 'CONFIG_SAVE_ERROR'
        });
    }
});

// Reset configuration to defaults
app.post('/api/config/reset', optionalAuth, async (req, res) => {
    try {
        const defaultConfig = createDefaultConfig();
        await saveConfig(defaultConfig);

        res.json({
            success: true,
            message: 'Configuration reset to defaults'
        });
    } catch (error) {
        console.error('Config reset error:', error);
        res.status(500).json({
            error: 'Failed to reset configuration',
            code: 'CONFIG_RESET_ERROR'
        });
    }
});

// Data routes
app.get('/api/data', optionalAuth, async (req, res) => {
    try {
        const dataFile = path.join(DATA_DIR, 'lighting_data.json');
        const data = await fs.readFile(dataFile, 'utf8');
        const lightingData = JSON.parse(data);

        res.json({
            success: true,
            data: lightingData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json({
                success: true,
                data: { scenes: [], schedules: [] },
                timestamp: new Date().toISOString()
            });
        } else {
            console.error('Data load error:', error);
            res.status(500).json({
                error: 'Failed to load lighting data',
                code: 'DATA_LOAD_ERROR'
            });
        }
    }
});

app.post('/api/data', optionalAuth, async (req, res) => {
    try {
        const dataFile = path.join(DATA_DIR, 'lighting_data.json');
        const dataToSave = {
            ...req.body,
            lastModified: new Date().toISOString()
        };

        await fs.writeFile(dataFile, JSON.stringify(dataToSave, null, 2));

        res.json({
            success: true,
            message: 'Lighting data saved successfully'
        });
    } catch (error) {
        console.error('Data save error:', error);
        res.status(500).json({
            error: 'Failed to save lighting data',
            code: 'DATA_SAVE_ERROR'
        });
    }
});

// Backup routes
app.get('/api/backups', optionalAuth, async (req, res) => {
    try {
        const backupDir = path.join(DATA_DIR, 'backups');
        const files = await fs.readdir(backupDir);

        const backups = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(backupDir, file);
                const stats = await fs.stat(filePath);
                backups.push({
                    filename: file,
                    size: stats.size,
                    created: stats.mtime.toISOString(),
                    downloadUrl: `/api/backups/download/${file}`
                });
            }
        }

        // Sort by creation date (newest first)
        backups.sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json({
            success: true,
            backups
        });
    } catch (error) {
        console.error('Backup list error:', error);
        res.status(500).json({
            error: 'Failed to list backups',
            code: 'BACKUP_LIST_ERROR'
        });
    }
});

app.post('/api/backups', optionalAuth, async (req, res) => {
    try {
        const dataFile = path.join(DATA_DIR, 'lighting_data.json');
        const backupDir = path.join(DATA_DIR, 'backups');

        // Ensure backup directory exists
        await fs.mkdir(backupDir, { recursive: true });

        // Read current data and config
        let lightingData = { scenes: [], schedules: [] };
        let config = {};

        try {
            const data = await fs.readFile(dataFile, 'utf8');
            lightingData = JSON.parse(data);
        } catch (e) {
            // No data file yet
        }

        try {
            const configData = await fs.readFile(CONFIG_FILE, 'utf8');
            config = JSON.parse(configData);
            // Remove sensitive data from backup
            if (config.authentication) {
                config.authentication.pin = "";
            }
        } catch (e) {
            // No config file yet
        }

        const backup = {
            version: "1.0.0",
            created: new Date().toISOString(),
            type: "manual",
            data: lightingData,
            config: config
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `backup_${timestamp}.json`);

        await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));

        res.json({
            success: true,
            message: 'Backup created successfully',
            filename: `backup_${timestamp}.json`
        });
    } catch (error) {
        console.error('Backup create error:', error);
        res.status(500).json({
            error: 'Failed to create backup',
            code: 'BACKUP_CREATE_ERROR'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        code: 'NOT_FOUND'
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server
async function startServer() {
    try {
        await ensureDirectories();

        const server = app.listen(PORT, () => {
            console.log(`✅ Server is running at http://localhost:${PORT}`);
            console.log(`📁 Config file: ${CONFIG_FILE}`);
            console.log(`📁 Data directory: ${DATA_DIR}`);
            console.log(`🔧 Environment: ${NODE_ENV}`);
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use`);
            } else {
                console.error('❌ Server error:', error);
            }
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();