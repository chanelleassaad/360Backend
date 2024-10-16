const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    title: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      required: true,
    },
    video: {
      type: String,
      required: true,
    },
  },
  {
    versionKey: false,
  }
);

// Create the Project model
const Project = mongoose.model("Project", projectSchema);

// Export the model
module.exports = Project;
