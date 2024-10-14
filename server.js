const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");

dotenv.config()

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretKey = process.env.SECRET_KEY;

const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
  region: bucketRegion,
});

const express = require("express");
const connectDB = require("./connectDB"); // Adjust the path if necessary
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const projectRoutes = require("./routes/projects"); // Import project routes
const adminRoutes = require("./routes/admin"); // Import admin routes
const emailRoutes = require("./routes/email"); // Import email routes

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
      title: "360 Production API",
      version: "1.0.0",
      description: "API for managing projects",
    },
    servers: [
      {
        url: "http://localhost:5000", // Update this if your server runs on a different port
      },
    ],
  },
  apis: ["./routes/projects.js", "./routes/admin.js", "./routes/email.js"], // Path to the API docs (update if necessary)
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Use project routes
app.use("/api/projects", projectRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/email", emailRoutes);
console.log("Email routes mounted at /api/email");

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
