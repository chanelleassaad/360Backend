const mongoose = require("mongoose");

// Load environment variables from .env file
require("dotenv").config();

const connectDB = async () => {
  try {
    const DB_URI = process.env.DB_URI;
    const connection = await mongoose.connect(DB_URI);
    console.log("MongoDB connected");
    console.log(`Connected to database: ${connection.connections[0].name}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
