//make config object immutable
import dotenv from "dotenv";
dotenv.config();

const config = {
    mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/urbanpocket",
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || 3000
};

Object.freeze(config);

const getConfig = (key) => {
    if (!config[key]) {
        throw new Error(`Config key ${key} not found`);
    }
    return config[key];
}

export default getConfig;
