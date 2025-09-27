//make config object immutable
import dotenv from "dotenv";
import { ApiError } from "../utils/errors.js";
dotenv.config();

const config = {
    mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/urbanpocket",
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || 3000,

    // redis setup
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
};

Object.freeze(config);

const getConfig = (key) => {
    // Treat only undefined as missing. Allow empty string or 0 if intentionally set.
    if (!(key in config) || typeof config[key] === 'undefined') {
        throw new Error(`Config key ${key} not found`);
    }
    return config[key];
}

/**
 * Validate required config keys on startup and throw a helpful error if any are missing.
 * @param {string[]} requiredKeys
 */
const validateConfig = (requiredKeys = []) => {
    const missing = [];
    for (const k of requiredKeys) {
        if (typeof config[k] === 'undefined' || config[k] === null) {
            missing.push(k);
        }
    }
    if (missing.length) {

        // through api error so it gets logged consistently
        throw new ApiError(`Missing required config keys: ${missing.join(', ')}. Please set them in environment.`, { statusCode: 500, code: 'CONFIG_ERROR' });

    }
}

// get all keys of config in an array 
const requiredKeys = Object.keys(config);

// check is every key is present
validateConfig(requiredKeys)

export { getConfig };
export default getConfig;
