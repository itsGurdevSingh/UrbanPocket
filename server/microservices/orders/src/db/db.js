import mongoose from "mongoose";
import getConfig from "../config/config_keys.js";
import logger from "../utils/logger.js";

const connectToDb = async () => {
    try {
        await mongoose.connect(getConfig("mongoUrl"));
        logger.info("Connected to MongoDB");
    } catch (error) {
        logger.error("Error connecting to MongoDB:", { error });
        process.exit(1); // Exit process on database connection failure
    }
};

export default connectToDb;
