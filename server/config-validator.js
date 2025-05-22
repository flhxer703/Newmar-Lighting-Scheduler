// config-validator.js
const Joi = require('joi');

const configSchema = Joi.object({
    connection: Joi.object({
        controller_ip: Joi.string().ip().required(),
        controller_port: Joi.number().port().required(),
        use_ssl: Joi.boolean().default(false),
        auto_connect: Joi.boolean().default(false),
        reconnect_attempts: Joi.number().min(0).max(10).default(5),
        ping_interval: Joi.number().min(5000).default(30000)
    }).required(),

    authentication: Joi.object({
        pin: Joi.string().pattern(/^\d{4,8}$/).allow(''),
        remember_pin: Joi.boolean().default(false),
        session_timeout: Joi.number().min(60000).default(3600000)
    }).required(),

    ui: Joi.object({
        theme: Joi.string().valid('default', 'dark', 'light').default('default'),
        show_diagnostics: Joi.boolean().default(true),
        default_tab: Joi.string().valid('lights', 'scenes', 'schedules', 'diagnostics').default('lights'),
        room_order: Joi.array().items(Joi.string()).default([
            "Living Room", "Kitchen", "Bedroom", "Bath", "Half Bath", "Exterior"
        ])
    }).required(),

    scheduling: Joi.object({
        enabled: Joi.boolean().default(true),
        check_interval: Joi.number().min(10000).default(60000),
        timezone: Joi.string().default('America/New_York')
    }).required(),

    backup: Joi.object({
        auto_backup: Joi.boolean().default(true),
        backup_interval: Joi.number().min(3600000).default(86400000),
        max_backups: Joi.number().min(1).max(100).default(10)
    }).required(),

    advanced: Joi.object({
        debug_mode: Joi.boolean().default(false),
        log_level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
        websocket_timeout: Joi.number().min(5000).default(10000)
    }).required()
});

function validateConfig(config) {
    const { error, value } = configSchema.validate(config, {
        allowUnknown: false,
        stripUnknown: true
    });

    if (error) {
        throw new Error(`Configuration validation failed: ${error.details[0].message}`);
    }

    return value;
}

function sanitizeConfig(config) {
    // Remove sensitive data for client-side use
    const sanitized = JSON.parse(JSON.stringify(config));

    if (!sanitized.authentication.remember_pin) {
        sanitized.authentication.pin = "";
    }

    return sanitized;
}

module.exports = {
    validateConfig,
    sanitizeConfig,
    configSchema
};