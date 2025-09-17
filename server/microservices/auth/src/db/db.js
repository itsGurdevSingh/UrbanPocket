import mongoose from "mongoose";
import getConfig from "../config/config_keys.js";

const connectToDb = async () => {
  try {
    await mongoose.connect(getConfig("mongoUrl"));
    console.log("Connected to MongoDB");
  } catch (error) {
    console.log("Error connecting to MongoDB:", error);
  };
};

export default connectToDb;