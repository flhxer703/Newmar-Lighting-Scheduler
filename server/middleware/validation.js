// server/middleware/validation.js
const Joi = require('joi');

// Scene validation schema
const sceneSchema = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    created: Joi.string().isoDate(),
    room: Joi.number().integer().min(0).max(5).allow(null),
    lights: Joi.array().items(
        Joi.object({
            index: Joi.number().integer().min(1).required(),
            name: Joi.string().required(),
            brightness: Joi.number().integer().min(0).max(100).required(),
            room: Joi.number().integer().min(0).max(5).required()
        })
    ).min(1).required()
});

// Schedule validation schema  
const scheduleSchema = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    enabled: Joi.boolean().default(true),
    created: Joi.string().isoDate(),
    events: Joi.array().items(
        Joi.object({
            time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
            days: Joi.array().items(
                Joi.string().valid('sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat')
            ).min(1).required(),
            action: Joi.string().valid('load_scene', 'lights_off', 'lights_on').required(),
            scene: Joi.string().when('action', {
                is: 'load_scene',
                then: Joi.required(),
                otherwise: Joi.optional()
            })
        })
    ).min(1).required()
});

// Configuration validation schema
const configSchema = Joi.object({
    connection: Joi.object({
        controller_ip: Joi.string().ip().required(),
        controller_port: Joi.number().port().required(),
        use_ssl: Joi.boolean().default(false),
        auto_connect: Joi.boolean().default(false),
        reconnect_attempts: Joi.number().min(0).max(10).default(5),
        ping_interval: Joi.number().min(5000).default(30000)
    }),
    authentication: Joi.object({
        pin: Joi.string().pattern(/^\d{4,8}$/).allow(''),
        remember_pin: Joi.boolean().default(false),
        session_timeout: Joi.number().min(60000).default(3600000)
    }),
    ui: Joi.object({
        theme: Joi.string().valid('default', 'dark', 'light').default('default'),
        show_diagnostics: Joi.boolean().default(true),
        default_tab: Joi.string().valid('lights', 'scenes', 'schedules', 'diagnostics').default('lights'),
        room_order: Joi.array().items(Joi.string()).default([
            "Living Room", "Kitchen", "Bedroom", "Bath", "Half Bath", "Exterior"
        ])
    }),
    scheduling: Joi.object({
        enabled: Joi.boolean().default(true),
        check_interval: Joi.number().min(10000).default(60000),
        timezone: Joi.string().default('America/New_York')
    }),
    backup: Joi.object({
        auto_backup: Joi.boolean().default(true),
        backup_interval: Joi.number().min(3600000).default(86400000),
        max_backups: Joi.number().min(1).max(100).default(10)
    }),
    advanced: Joi.object({
        debug_mode: Joi.boolean().default(false),
        log_level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
        websocket_timeout: Joi.number().min(5000).default(10000)
    })
});

// Generic validation middleware factory
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            allowUnknown: false,
            stripUnknown: true,
            abortEarly: false
        });

        if (error) {
            const details = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context.value
            }));

            return res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details
            });
        }

        // Replace the original data with validated/sanitized data
        req[property] = value;
        next();
    };
};

// Specific validation middlewares
const validateScene = validate(sceneSchema);
const validateSchedule = validate(scheduleSchema);
const validateConfig = validate(configSchema);

// Light command validation
const validateLightCommand = (req, res, next) => {
    const { lightIndex, brightness, action } = req.body;

    const schema = Joi.object({
        lightIndex: Joi.number().integer().min(1).max(255).required(),
        brightness: Joi.number().integer().min(0).max(100).when('action', {
            is: Joi.exist(),
            then: Joi.optional(),
            otherwise: Joi.required()
        }),
        action: Joi.string().valid('on', 'off', 'toggle').optional()
    });

    const { error, value } = schema.validate({ lightIndex, brightness, action });

    if (error) {
        return res.status(400).json({
            error: 'Invalid light command',
            code: 'INVALID_LIGHT_COMMAND',
            details: error.details[0].message
        });
    }

    req.body = value;
    next();
};

// File upload validation
const validateFileUpload = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            error: 'No file uploaded',
            code: 'NO_FILE'
        });
    }

    // Check file size (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
            error: 'File too large (max 5MB)',
            code: 'FILE_TOO_LARGE'
        });
    }

    // Check file type
    if (req.file.mimetype !== 'application/json') {
        return res.status(400).json({
            error: 'Only JSON files allowed',
            code: 'INVALID_FILE_TYPE'
        });
    }

    next();
};

// Sanitize input to prevent XSS
const sanitizeInput = (req, res, next) => {
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/[<>\"'&]/g, (char) => {
            const chars = {
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;'
            };
            return chars[char];
        });
    };

    const sanitizeObject = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        } else if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = sanitizeObject(value);
            }
            return sanitized;
        } else if (typeof obj === 'string') {
            return sanitizeString(obj);
        }
        return obj;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);

    next();
};

module.exports = {
    validate,
    validateScene,
    validateSchedule,
    validateConfig,
    validateLightCommand,
    validateFileUpload,
    sanitizeInput,
    schemas: {
        sceneSchema,
        scheduleSchema,
        configSchema
    }
};