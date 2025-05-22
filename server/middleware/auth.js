// // server/middleware/auth.js
// const rateLimit = require('express-rate-limit');

// // Basic PIN validation
// const validatePIN = (req, res, next) => {
//     const { pin } = req.body;

//     if (!pin || typeof pin !== 'string') {
//         return res.status(400).json({
//             error: 'PIN is required'
//         });
//     }

//     if (!/^\d{4,8}$/.test(pin)) {
//         return res.status(400).json({
//             error: 'PIN must be 4-8 digits'
//         });
//     }

//     next();
// };

// // Rate limiting for PIN attempts
// const pinRateLimit = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 5,
//     message: { error: 'Too many PIN attempts' }
// });

// // Optional authentication
// const optionalAuth = (req, res, next) => {
//     // For now, just pass through
//     // In production, implement proper session/token validation
//     next();
// };

// module.exports = {
//     validatePIN,
//     pinRateLimit,
//     optionalAuth
// };

// // server/middleware/validation.js
// const Joi = require('joi');

// // Basic input sanitization
// const sanitizeInput = (req, res, next) => {
//     const sanitizeString = (str) => {
//         if (typeof str !== 'string') return str;
//         return str.replace(/[<>\"'&]/g, '');
//     };

//     const sanitizeObject = (obj) => {
//         if (Array.isArray(obj)) {
//             return obj.map(sanitizeObject);
//         } else if (obj && typeof obj === 'object') {
//             const sanitized = {};
//             for (const [key, value] of Object.entries(obj)) {
//                 sanitized[key] = sanitizeObject(value);
//             }
//             return sanitized;
//         } else if (typeof obj === 'string') {
//             return sanitizeString(obj);
//         }
//         return obj;
//     };

//     if (req.body) req.body = sanitizeObject(req.body);
//     if (req.query) req.query = sanitizeObject(req.query);

//     next();
// };

// // Validate scene data
// const validateScene = (req, res, next) => {
//     const { name, lights } = req.body;

//     if (!name || typeof name !== 'string' || name.length > 50) {
//         return res.status(400).json({
//             error: 'Valid scene name required (max 50 characters)'
//         });
//     }

//     if (!lights || !Array.isArray(lights) || lights.length === 0) {
//         return res.status(400).json({
//             error: 'Scene must contain at least one light'
//         });
//     }

//     next();
// };

// // Validate schedule data
// const validateSchedule = (req, res, next) => {
//     const { name, events } = req.body;

//     if (!name || typeof name !== 'string' || name.length > 50) {
//         return res.status(400).json({
//             error: 'Valid schedule name required (max 50 characters)'
//         });
//     }

//     if (!events || !Array.isArray(events) || events.length === 0) {
//         return res.status(400).json({
//             error: 'Schedule must contain at least one event'
//         });
//     }

//     next();
// };

// module.exports = {
//     sanitizeInput,
//     validateScene,
//     validateSchedule
// };

// // server/routes/data.js
// const express = require('express');
// const router = express.Router();
// const fs = require('fs').promises;
// const path = require('path');

// // Get lighting data
// router.get('/', async (req, res) => {
//     try {
//         const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
//         const data = await fs.readFile(dataFile, 'utf8');
//         res.json(JSON.parse(data));
//     } catch (error) {
//         if (error.code === 'ENOENT') {
//             res.json({ scenes: [], schedules: [] });
//         } else {
//             res.status(500).json({ error: 'Failed to load data' });
//         }
//     }
// });

// // Save lighting data
// router.post('/', async (req, res) => {
//     try {
//         const dataFile = path.join(process.env.DATA_DIR || './data', 'lighting_data.json');
//         await fs.writeFile(dataFile, JSON.stringify(req.body, null, 2));
//         res.json({ success: true });
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to save data' });
//     }
// });

// module.exports = router;


// server/middleware/auth.js
const rateLimit = require('express-rate-limit');

// Basic PIN validation
const validatePIN = (req, res, next) => {
    const { pin } = req.body;

    if (!pin || typeof pin !== 'string') {
        return res.status(400).json({
            error: 'PIN is required',
            code: 'PIN_REQUIRED'
        });
    }

    if (!/^\d{4,8}$/.test(pin)) {
        return res.status(400).json({
            error: 'PIN must be 4-8 digits',
            code: 'INVALID_PIN_FORMAT'
        });
    }

    next();
};

// Rate limiting for PIN attempts
const pinRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 PIN attempts per windowMs
    message: {
        error: 'Too many PIN attempts',
        code: 'RATE_LIMITED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Optional authentication middleware
// For now, this is a passthrough but can be enhanced later
const optionalAuth = (req, res, next) => {
    // TODO: Implement proper session/token validation when needed
    // For now, just pass through
    next();
};

// Enhanced authentication middleware (for future use)
const requireAuth = (req, res, next) => {
    // TODO: Implement proper authentication checking
    // For now, just pass through
    next();
};

module.exports = {
    validatePIN,
    pinRateLimit,
    optionalAuth,
    requireAuth
};