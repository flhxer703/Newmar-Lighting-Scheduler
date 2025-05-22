const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

const CONFIG_FILE = process.env.CONFIG_FILE || './config/settings.json';
const DATA_DIR = process.env.DATA_DIR || './data';
const PORT = process.env.PORT || 3000;

const { validateConfig } = require('./server/middleware/validation');

app.use(express.json());
app.use(express.static('public'));

console.log("🚀 RV Lighting Control Server starting...");

// Ensure directories exist
async function ensureDirectories() {
    const configDir = path.dirname(CONFIG_FILE);
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(path.join(DATA_DIR, 'backups'), { recursive: true });
}

// Load configuration from disk
async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log('⚠️ Config file not found or invalid. Using empty config.');
        return {};
    }
}

// Save configuration to disk
async function saveConfig(config) {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

app.post('/api/config', validateConfig, async (req, res) => {
    try {
        const currentConfig = await loadConfig();
        const updatedConfig = { ...currentConfig, ...req.body };
        await saveConfig(updatedConfig);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
ensureDirectories().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Server is running at http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ Failed to initialize server:', err);
    process.exit(1);
});