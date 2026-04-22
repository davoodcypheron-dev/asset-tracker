const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/**
 * Synchronizes config.json from .env file
 */
function syncConfig() {
    const envPath = path.join(__dirname, '../../.env');
    const configPath = path.join(__dirname, '../config.json');

    // Default configuration
    const configData = {
        port: 3000,
        db: {
            user: '',
            password: '',
            server: '',
            database: '',
            options: {
                encrypt: true,
                trustServerCertificate: true
            }
        }
    };

    // Load .env
    const envConfig = dotenv.config({ path: envPath }).parsed;

    if (envConfig) {
        // Map env variables to structured object
        configData.port = parseInt(envConfig.PORT) || configData.port;
        configData.db.user = envConfig.DB_USER || configData.db.user;
        configData.db.password = envConfig.DB_PASSWORD || configData.db.password;
        configData.db.server = envConfig.DB_SERVER || configData.db.server;
        configData.db.database = envConfig.DB_DATABASE || configData.db.database;
    } else {
        console.warn('Warning: .env file not found or empty. Using default/existing config.json values.');
        if (fs.existsSync(configPath)) return; // Keep existing if .env is missing
    }

    // Write to config.json
    try {
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 4), 'utf8');
        console.log('Successfully synchronized config.json from .env');
    } catch (error) {
        console.error('Error writing config.json:', error);
    }
}

/**
 * Loads configuration from config.json
 */
function loadConfig() {
    const configPath = path.join(__dirname, '../config.json');

    if (!fs.existsSync(configPath)) {
        syncConfig();
    }

    try {
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading config.json:', error);
        return null;
    }
}

module.exports = {
    syncConfig,
    loadConfig
};
