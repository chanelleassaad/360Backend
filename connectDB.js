// const mongoose = require("mongoose");

// // Load environment variables from .env file
// require("dotenv").config();

// const connectDB = async () => {
//   try {
//     const DB_URI = process.env.DB_URI; // Use process.env to access environment variables
//     await mongoose.connect(DB_URI);
//     console.log("MongoDB connected");
//   } catch (error) {
//     console.error(`Error: ${error.message}`);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;

const mongoose = require("mongoose");

// Load environment variables from .env file
require("dotenv").config();

const connectDB = async () => {
  try {
    const DB_URI = process.env.DB_URI; // Use process.env to access environment variables
    const connection = await mongoose.connect(DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
    console.log(`Connected to database: ${connection.connections[0].name}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;

