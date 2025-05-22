// server/routes/backup.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');

// List available backups
router.get('/', optionalAuth, async (req, res) => {
    try {
        const backupDir = path.join(process.env.DATA_DIR || './data', 'backups');
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
        res.status(500).json({
            error: 'Failed to list backups',
            code: 'BACKUP_LIST_ERROR'
        });
    }
});

// Create manual backup
router.post('/', optionalAuth, async (req, res) => {
    try {
        const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
        const configFile = process.env.CONFIG_FILE || './config/settings.json';
        const backupDir = path.join(process.env.DATA_DIR || './data', 'backups');

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
            const configData = await fs.readFile(configFile, 'utf8');
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
        res.status(500).json({
            error: 'Failed to create backup',
            code: 'BACKUP_CREATE_ERROR'
        });
    }
});

// Download backup file
router.get('/download/:filename', optionalAuth, async (req, res) => {
    try {
        const backupDir = path.join(process.env.DATA_DIR || './data', 'backups');
        const backupFile = path.join(backupDir, req.params.filename);

        // Security check - ensure filename doesn't contain path traversal
        if (req.params.filename.includes('..') || req.params.filename.includes('/')) {
            return res.status(400).json({
                error: 'Invalid filename',
                code: 'INVALID_FILENAME'
            });
        }

        // Check if file exists
        await fs.access(backupFile);

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
        res.setHeader('Content-Type', 'application/json');

        // Send file
        const data = await fs.readFile(backupFile, 'utf8');
        res.send(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({
                error: 'Backup file not found',
                code: 'BACKUP_NOT_FOUND'
            });
        } else {
            res.status(500).json({
                error: 'Failed to download backup',
                code: 'BACKUP_DOWNLOAD_ERROR'
            });
        }
    }
});

// Delete backup file
router.delete('/:filename', optionalAuth, async (req, res) => {
    try {
        const backupDir = path.join(process.env.DATA_DIR || './data', 'backups');
        const backupFile = path.join(backupDir, req.params.filename);

        // Security check
        if (req.params.filename.includes('..') || req.params.filename.includes('/')) {
            return res.status(400).json({
                error: 'Invalid filename',
                code: 'INVALID_FILENAME'
            });
        }

        await fs.unlink(backupFile);

        res.json({
            success: true,
            message: 'Backup deleted successfully'
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({
                error: 'Backup file not found',
                code: 'BACKUP_NOT_FOUND'
            });
        } else {
            res.status(500).json({
                error: 'Failed to delete backup',
                code: 'BACKUP_DELETE_ERROR'
            });
        }
    }
});

// Restore from backup
router.post('/restore/:filename', optionalAuth, async (req, res) => {
    try {
        const backupDir = path.join(process.env.DATA_DIR || './data', 'backups');
        const backupFile = path.join(backupDir, req.params.filename);

        // Security check
        if (req.params.filename.includes('..') || req.params.filename.includes('/')) {
            return res.status(400).json({
                error: 'Invalid filename',
                code: 'INVALID_FILENAME'
            });
        }

        const backupData = await fs.readFile(backupFile, 'utf8');
        const backup = JSON.parse(backupData);

        // Restore data
        if (backup.data) {
            const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
            await fs.writeFile(dataFile, JSON.stringify(backup.data, null, 2));
        }

        // Restore config (optional, based on query parameter)
        if (req.query.includeConfig === 'true' && backup.config) {
            const configFile = process.env.CONFIG_FILE || './config/settings.json';
            await fs.writeFile(configFile, JSON.stringify(backup.config, null, 2));
        }

        res.json({
            success: true,
            message: 'Backup restored successfully',
            restored: {
                data: !!backup.data,
                config: req.query.includeConfig === 'true' && !!backup.config
            }
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({
                error: 'Backup file not found',
                code: 'BACKUP_NOT_FOUND'
            });
        } else {
            res.status(500).json({
                error: 'Failed to restore backup',
                code: 'BACKUP_RESTORE_ERROR'
            });
        }
    }
});

module.exports = router;