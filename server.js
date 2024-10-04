const express = require("express");
const connectDB = require("./connectDB"); // Adjust the path if necessary
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const projectRoutes = require("./routes/projects"); // Import project routes

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Connect to MongoDB
connectDB();

// Swagger documentation setup
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Project API",
      version: "1.0.0",
      description: "API for managing projects",
    },
    servers: [
      {
        url: "http://localhost:5000", // Update this if your server runs on a different port
      },
    ],
  },
  apis: ["./routes/projects.js"], // Path to the API docs (update if necessary)
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Use project routes
app.use("/api/projects", projectRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
