//Configuration object - make immutable
import dotenv from "dotenv";
import { ApiError } from "../utils/errors.js";
dotenv.config();

const config = {
    mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/order-service",
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.ORDER_SERVICE_PORT || 3003,

    // Redis setup
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    // Microservice URLs
    authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:4000",
    productServiceUrl: process.env.PRODUCT_SERVICE_URL || "http://localhost:3001",
    cartServiceUrl: process.env.CART_SERVICE_URL || "http://localhost:3002",
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
