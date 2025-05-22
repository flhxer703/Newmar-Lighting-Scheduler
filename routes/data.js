// server/routes/data.js
const express = require('express');
const router = express.Router();
const { validateScene, validateSchedule } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');

// Get all lighting data
router.get('/', optionalAuth, async (req, res) => {
    try {
        const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
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
            res.status(500).json({
                error: 'Failed to load lighting data',
                code: 'DATA_LOAD_ERROR'
            });
        }
    }
});

// Save lighting data
router.post('/', optionalAuth, async (req, res) => {
    try {
        const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
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
        res.status(500).json({
            error: 'Failed to save lighting data',
            code: 'DATA_SAVE_ERROR'
        });
    }
});

// Save individual scene
router.post('/scenes', validateScene, async (req, res) => {
    try {
        const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
        let lightingData = { scenes: [], schedules: [] };

        try {
            const data = await fs.readFile(dataFile, 'utf8');
            lightingData = JSON.parse(data);
        } catch (e) {
            // File doesn't exist yet
        }

        // Add or update scene
        const sceneIndex = lightingData.scenes.findIndex(s => s.name === req.body.name);
        if (sceneIndex >= 0) {
            lightingData.scenes[sceneIndex] = req.body;
        } else {
            lightingData.scenes.push(req.body);
        }

        lightingData.lastModified = new Date().toISOString();
        await fs.writeFile(dataFile, JSON.stringify(lightingData, null, 2));

        res.json({
            success: true,
            message: `Scene "${req.body.name}" saved successfully`
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to save scene',
            code: 'SCENE_SAVE_ERROR'
        });
    }
});

// Delete scene
router.delete('/scenes/:name', async (req, res) => {
    try {
        const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
        const data = await fs.readFile(dataFile, 'utf8');
        const lightingData = JSON.parse(data);

        const initialLength = lightingData.scenes.length;
        lightingData.scenes = lightingData.scenes.filter(s => s.name !== req.params.name);

        if (lightingData.scenes.length === initialLength) {
            return res.status(404).json({
                error: 'Scene not found',
                code: 'SCENE_NOT_FOUND'
            });
        }

        lightingData.lastModified = new Date().toISOString();
        await fs.writeFile(dataFile, JSON.stringify(lightingData, null, 2));

        res.json({
            success: true,
            message: `Scene "${req.params.name}" deleted successfully`
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete scene',
            code: 'SCENE_DELETE_ERROR'
        });
    }
});

// Save individual schedule
router.post('/schedules', validateSchedule, async (req, res) => {
    try {
        const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
        let lightingData = { scenes: [], schedules: [] };

        try {
            const data = await fs.readFile(dataFile, 'utf8');
            lightingData = JSON.parse(data);
        } catch (e) {
            // File doesn't exist yet
        }

        // Add or update schedule
        const scheduleIndex = lightingData.schedules.findIndex(s => s.name === req.body.name);
        if (scheduleIndex >= 0) {
            lightingData.schedules[scheduleIndex] = req.body;
        } else {
            lightingData.schedules.push(req.body);
        }

        lightingData.lastModified = new Date().toISOString();
        await fs.writeFile(dataFile, JSON.stringify(lightingData, null, 2));

        res.json({
            success: true,
            message: `Schedule "${req.body.name}" saved successfully`
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to save schedule',
            code: 'SCHEDULE_SAVE_ERROR'
        });
    }
});

// Delete schedule
router.delete('/schedules/:name', async (req, res) => {
    try {
        const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
        const data = await fs.readFile(dataFile, 'utf8');
        const lightingData = JSON.parse(data);

        const initialLength = lightingData.schedules.length;
        lightingData.schedules = lightingData.schedules.filter(s => s.name !== req.params.name);

        if (lightingData.schedules.length === initialLength) {
            return res.status(404).json({
                error: 'Schedule not found',
                code: 'SCHEDULE_NOT_FOUND'
            });
        }

        lightingData.lastModified = new Date().toISOString();
        await fs.writeFile(dataFile, JSON.stringify(lightingData, null, 2));

        res.json({
            success: true,
            message: `Schedule "${req.params.name}" deleted successfully`
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete schedule',
            code: 'SCHEDULE_DELETE_ERROR'
        });
    }
});

module.exports = router;
