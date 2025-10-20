//Configuration object - make immutable
import dotenv from "dotenv";
import { ApiError } from "../utils/errors.js";
dotenv.config();

const config = {
    mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/microservice",
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PRODUCT_SERVICE_PORT || 3001,

    // Redis setup
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    // imagekit.io keys
    IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY,
    IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
    IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,

    // microservice URLs
    authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:4000",
};

Object.freeze(config);

/**
 * Get configuration value by key
 * @param {string} key - Configuration key
 * @returns {any} Configuration value
 * @throws {ApiError} If key is not found
 */
const getConfig = (key) => {
    
    if (!(key in config)) {
        throw new ApiError(
            `Configuration key '${key}' not found`,
            { statusCode: 500, code: "CONFIG_ERROR" }
        );
    }
    return config[key];
};

export default getConfig;
export { config };