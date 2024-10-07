const mongoose = require("mongoose");

// Load environment variables from .env file
require("dotenv").config();

const connectDB = async () => {
  try {
    const DB_URI = process.env.DB_URI; // Use process.env to access environment variables
    await mongoose.connect(DB_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
