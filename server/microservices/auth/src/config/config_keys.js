//make config object immutable
import dotenv from "dotenv";
dotenv.config();

const config = {
    mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/urbanpocket",
    jwtSecret: process.env.JWT_SECRET
};

Object.freeze(config);

const getConfig = (key) => {
    if (!config[key]) {
        throw new Error(`Config key ${key} not found`);
    }
    return config[key];
}

export default getConfig;
