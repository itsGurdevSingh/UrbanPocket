//make config object immutable
import dotenv from "dotenv";
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
    REDIS_PASSWORD: process.env.REDIS_PASSWORD
};

Object.freeze(config);

const getConfig = (key) => {
    if (!config[key]) {
        throw new Error(`Config key ${key} not found`);
    }
    return config[key];
}

export default getConfig;
