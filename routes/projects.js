const express = require("express");
const router = express.Router();
const multer = require("multer");
const { uploadFile, deleteFile } = require("../services/s3Service"); // Ensure you import your S3 upload function
const Project = require("../models/Project"); // Adjust the path as needed
const upload = multer({ dest: "uploads/" }); // Specify the directory to temporarily store uploaded files
const dotenv = require("dotenv");

dotenv.config();

/**
 * @swagger
 * /api/projects/getProjects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: A list of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   location:
 *                     type: string
 *                   year:
 *                     type: number
 *                   description:
 *                     type: string
 *                   images:
 *                     type: array
 *                     items:
 *                       type: string
 *                   video:
 *                     type: string
 *       500:
 *         description: Server error
 */
router.get("/getProjects", async (req, res) => {
  try {
    const projects = await Project.find();
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/projects/addProject:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               location:
 *                 type: string
 *               year:
 *                 type: number
 *               description:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of image files
 *               video:
 *                 type: string
 *                 description: Video file
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Invalid input
 */
router.post(
  "/addProject",
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    const { title, location, year, description } = req.body;
    const images = req.files["images"]; // Array of image files
    const video = req.files["video"] ? req.files["video"][0] : null; // Single video file

    try {
      const imageUploadPromises = images.map((image) => {
        const imageKey = image.originalname; // Use a unique key for S3
        return uploadFile(
          process.env.BUCKET_NAME,
          imageKey,
          image.path,
          image.mimetype
        );
      });

      // Upload video to S3 if provided
      let videoUrl = null;
      if (video) {
        const videoKey = video.originalname; // Use a unique key for S3
        await uploadFile(
          process.env.BUCKET_NAME,
          videoKey,
          video.path,
          video.mimetype
        );
        videoUrl = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${videoKey}`; // Construct the S3 video URL
      }

      // Wait for all image uploads to complete
      await Promise.all(imageUploadPromises);

      // Construct the project object
      const project = new Project({
        title,
        location,
        year,
        description,
        images: images.map(
          (image) =>
            `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${image.originalname}`
        ), // Construct image URLs
        video: videoUrl,
      });

      // Save the project to the database
      const savedProject = await project.save();
      res.status(201).json(savedProject);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @swagger
 * /api/projects/deleteProject/{id}:
 *   delete:
 *     summary: Delete a project by ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *       404:
 *         description: Project not found
 *       500:
 *         description: Server error
 */
router.delete("/deleteProject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByIdAndDelete(id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/projects/updateProject/{id}:
 *   put:
 *     summary: Update a project by ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               location:
 *                 type: string
 *               year:
 *                 type: number
 *               description:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Project updated successfully
 *       404:
 *         description: Project not found
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.put(
  "/updateProject/:id",
  upload.fields([
    { name: "images", maxCount: 5 }, // Field name is 'images'
    { name: "video", maxCount: 1 }, // Field name is 'video'
  ]),
  async (req, res) => {
    const { id } = req.params;

    try {
      // Retrieve the existing project
      const existingProject = await Project.findById(id);
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Update fields only if provided in the request body
      existingProject.title = req.body.title ?? existingProject.title;
      existingProject.location = req.body.location ?? existingProject.location;
      existingProject.year = req.body.year ?? existingProject.year;
      existingProject.description =
        req.body.description ?? existingProject.description;

      // Handle image updates
      const newImages = req.files["images"] || []; // Access new images, default to an empty array
      const existingImages = existingProject.images || []; // Current images from the database

      // Delete old images from S3 if they exist and are not in the new images
      const imagesToDelete = existingImages.filter(
        (url) =>
          !newImages.some(
            (image) => image.originalname === url.split("/").pop()
          )
      );

      for (const oldImageUrl of imagesToDelete) {
        const oldImageKey = oldImageUrl.split("/").pop(); // Extract the key from the URL
        await deleteFile(process.env.BUCKET_NAME, oldImageKey); // Delete from S3
      }

      // Upload new images to S3
      const imageUploadPromises = newImages.map((image) => {
        const imageKey = image.originalname; // Use the original file name as the key
        return uploadFile(
          process.env.BUCKET_NAME,
          imageKey,
          image.path,
          image.mimetype
        );
      });

      const uploadedImageUrls = await Promise.all(imageUploadPromises);

      // Update images array with new S3 URLs
      existingProject.images = [
        ...existingImages.filter((url) => !imagesToDelete.includes(url)), // Keep existing images that were not deleted
        ...uploadedImageUrls.map(
          (url) => `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${url}`
        ), // Add new images
      ];

      // Handle video updates
      const video = req.files["video"] ? req.files["video"][0] : null; // Access video using bracket notation
      if (video) {
        // Delete the old video from S3 if it exists
        if (existingProject.video) {
          const oldVideoKey = existingProject.video.split("/").pop(); // Extract the key from the URL
          await deleteFile(process.env.BUCKET_NAME, oldVideoKey); // Delete from S3
        }

        // Upload the new video to S3
        const videoKey = video.originalname; // Use a unique key for S3
        await uploadFile(
          process.env.BUCKET_NAME,
          videoKey,
          video.path,
          video.mimetype
        );
        existingProject.video = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${videoKey}`; // Update video URL
      } else if (!video && existingProject.video) {
        // If no new video is provided, retain the existing video
        // If you want to delete the video when no new one is provided, uncomment the lines below
        const oldVideoKey = existingProject.video.split("/").pop(); // Extract the key from the URL
        await deleteFile(process.env.BUCKET_NAME, oldVideoKey); // Delete from S3
        existingProject.video = null; // Remove video URL from the project
      }

      // Save the updated project
      const updatedProject = await existingProject.save();
      res.status(200).json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error); // Log error for debugging
      res.status(400).json({ message: error.message });
    }
  }
);

module.exports = router;
