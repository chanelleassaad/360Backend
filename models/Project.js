// models/Project.js
const mongoose = require("mongoose");

// Define the project schema
const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  images: {
    type: [String], // Array of strings to hold image URLs
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
});

// Create the Project model
const Project = mongoose.model("Project", projectSchema);

// Export the model
module.exports = Project;
