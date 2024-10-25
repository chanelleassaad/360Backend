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
 *                   type: file
 *                 description: Array of image files
 *               video:
 *                 type: file
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

    // Find the project first
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Extract the S3 keys from image and video URLs
    const imageKeys = project.images.map((url) => {
      return url.split("/").pop(); // Get the file name from the URL
    });

    const videoKey = project.video ? project.video.split("/").pop() : null;

    // Delete images from S3
    const deleteImagePromises = imageKeys.map((key) => {
      return deleteFile(process.env.BUCKET_NAME, key); // S3 deletion function
    });

    // Delete video from S3 (if exists)
    if (videoKey) {
      await deleteFile(process.env.BUCKET_NAME, videoKey); // S3 deletion function
    }

    // Wait for all deletions to complete
    await Promise.all(deleteImagePromises);

    // Delete project from the database
    await Project.findByIdAndDelete(id);

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/projects/addVideo/{id}:
 *   put:
 *     summary: Add or replace a video for a project by ID
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
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file to upload
 *     responses:
 *       200:
 *         description: Video added or replaced successfully
 *       404:
 *         description: Project not found
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.put(
  "/addVideo/:id",
  upload.single("video"), // Expecting a single file upload with the field name 'video'
  async (req, res) => {
    const { id } = req.params;

    try {
      // Retrieve the existing project by ID
      const existingProject = await Project.findById(id);
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if a video file was uploaded
      const video = req.file ? req.file : null;
      if (!video) {
        return res.status(400).json({ message: "No video file provided" });
      }

      // If the project already has a video, delete the old one from S3
      if (existingProject.video) {
        const oldVideoKey = existingProject.video.split("/").pop();
        await deleteFile(process.env.BUCKET_NAME, oldVideoKey); // Delete old video from S3
      }

      // Upload the new video to S3
      const videoKey = video.originalname; // Use the original file name as the key
      await uploadFile(
        process.env.BUCKET_NAME,
        videoKey,
        video.path,
        video.mimetype
      );

      // Update the project's video URL with the new one
      existingProject.video = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${videoKey}`;

      // Save the updated project
      const updatedProject = await existingProject.save();
      res.status(200).json(updatedProject);
    } catch (error) {
      console.error("Error adding/replacing video:", error); // Log the error for debugging
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * @swagger
 * /api/projects/deleteVideo/{id}:
 *   delete:
 *     summary: Delete the video for a project by ID
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
 *         description: Video deleted successfully
 *       404:
 *         description: Project or video not found
 *       500:
 *         description: Server error
 */
router.delete("/deleteVideo/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Retrieve the existing project by ID
    const existingProject = await Project.findById(id);
    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check if the project has a video to delete
    if (!existingProject.video) {
      return res
        .status(404)
        .json({ message: "No video found for this project" });
    }

    // Delete the video from S3
    const oldVideoKey = existingProject.video.split("/").pop(); // Extract the key from the URL
    await deleteFile(process.env.BUCKET_NAME, oldVideoKey); // Delete video from S3

    // Remove the video URL from the project
    existingProject.video = null;

    // Save the updated project
    await existingProject.save();
    res.status(200).json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error("Error deleting video:", error); // Log the error for debugging
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @swagger
 * /api/projects/addImages/{id}:
 *   put:
 *     summary: Add one or more images to a project by ID
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
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of image files to upload
 *     responses:
 *       200:
 *         description: Images added successfully
 *       404:
 *         description: Project not found
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.put(
  "/addImages/:id",
  upload.array("images", 5), // Allow up to 5 images to be uploaded at once
  async (req, res) => {
    const { id } = req.params;

    try {
      // Retrieve the existing project by ID
      const existingProject = await Project.findById(id);
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if image files were uploaded
      const images = req.files; // Array of image files
      if (!images || images.length === 0) {
        return res.status(400).json({ message: "No image files provided" });
      }

      // Upload new images to S3
      const imageUploadPromises = images.map((image) => {
        const imageKey = image.originalname; // Use the original file name as the key
        return uploadFile(
          process.env.BUCKET_NAME,
          imageKey,
          image.path,
          image.mimetype
        ).then(
          () =>
            `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${imageKey}`
        );
      });

      const uploadedImageUrls = await Promise.all(imageUploadPromises);

      // Append new image URLs to the existing images array
      existingProject.images = [
        ...existingProject.images, // Keep existing images
        ...uploadedImageUrls, // Add new image URLs from S3
      ];

      // Save the updated project
      const updatedProject = await existingProject.save();
      res.status(200).json(updatedProject);
    } catch (error) {
      console.error("Error adding images:", error); // Log the error for debugging
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * @swagger
 * /api/projects/deleteImages/{id}:
 *   delete:
 *     summary: Delete multiple images for a project by ID and image names
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
 *       - in: query
 *         name: imageNames
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         required: true
 *         description: The array of image names to delete
 *     responses:
 *       200:
 *         description: Images deleted successfully
 *       404:
 *         description: Project or one or more images not found
 *       500:
 *         description: Server error
 */
router.delete("/deleteImages/:id", async (req, res) => {
  const { id } = req.params;
  const { imageNames } = req.query; // Array of image names passed as a query parameter

  try {
    // Ensure imageNames is provided and is an array
    if (!imageNames || !Array.isArray(imageNames)) {
      return res
        .status(400)
        .json({ message: "Image names must be provided as an array" });
    }

    // Retrieve the existing project by ID
    const existingProject = await Project.findById(id);
    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Filter out images that match any of the image names
    const imagesToDelete = existingProject.images.filter((imageUrl) =>
      imageNames.some((imageName) => imageUrl.includes(imageName))
    );

    if (imagesToDelete.length === 0) {
      return res
        .status(404)
        .json({ message: "No matching images found for deletion" });
    }

    // Delete each image from S3
    const deletePromises = imagesToDelete.map((imageUrl) => {
      const imageKey = imageUrl.split("/").pop(); // Extract the key from the URL
      return deleteFile(process.env.BUCKET_NAME, imageKey); // Delete from S3
    });
    await Promise.all(deletePromises); // Wait for all deletions to complete

    // Remove the deleted images from the project's images array
    existingProject.images = existingProject.images.filter(
      (imageUrl) => !imagesToDelete.includes(imageUrl)
    );

    // Save the updated project
    await existingProject.save();
    res.status(200).json({ message: "Images deleted successfully" });
  } catch (error) {
    console.error("Error deleting images:", error); // Log the error for debugging
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @swagger
 * /api/projects/editProjectData/{id}:
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the project
 *               location:
 *                 type: string
 *                 description: The location of the project
 *               year:
 *                 type: number
 *                 description: The year of the project
 *               description:
 *                 type: string
 *                 description: The description of the project
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
router.put("/editProjectData/:id", async (req, res) => {
  const { id } = req.params;
  const { title, location, year, description } = req.body;

  try {
    // Retrieve the existing project by ID
    const existingProject = await Project.findById(id);
    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Update the project fields only if they are provided in the request body
    if (title) existingProject.title = title;
    if (location) existingProject.location = location;
    if (year) existingProject.year = year;
    if (description) existingProject.description = description;

    // Save the updated project
    const updatedProject = await existingProject.save();
    res.status(200).json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error); // Log the error for debugging
    res.status(500).json({ message: "Server error" });
  }
});

// /**
//  * @swagger
//  * /api/projects/updateProject/{id}:
//  *   put:
//  *     summary: Update a project by ID
//  *     tags: [Projects]
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         schema:
//  *           type: string
//  *         required: true
//  *         description: The project ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         multipart/form-data:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               title:
//  *                 type: string
//  *               location:
//  *                 type: string
//  *               year:
//  *                 type: number
//  *               description:
//  *                 type: string
//  *               images:
//  *                 type: array
//  *                 items:
//  *                   type: string
//  *                   format: binary
//  *               video:
//  *                 type: string
//  *                 format: binary
//  *     responses:
//  *       200:
//  *         description: Project updated successfully
//  *       404:
//  *         description: Project not found
//  *       400:
//  *         description: Invalid input
//  *       500:
//  *         description: Server error
//  */
// router.put(
//   "/updateProject/:id",
//   upload.fields([
//     { name: "images", maxCount: 5 }, // Field name is 'images'
//     { name: "video", maxCount: 1 }, // Field name is 'video'
//   ]),
//   async (req, res) => {
//     const { id } = req.params;

//     try {
//       // Retrieve the existing project
//       const existingProject = await Project.findById(id);
//       if (!existingProject) {
//         return res.status(404).json({ message: "Project not found" });
//       }

//       // Update fields only if provided in the request body
//       existingProject.title = req.body.title ?? existingProject.title;
//       existingProject.location = req.body.location ?? existingProject.location;
//       existingProject.year = req.body.year ?? existingProject.year;
//       existingProject.description = req.body.description ?? existingProject.description;

//       // Handle image updates
//       const newImages = req.files["images"] || []; // Access new images, default to an empty array
//       const existingImages = existingProject.images || []; // Current images from the database

//       // Log the new images
//       console.log("New Images: ", newImages);

//       // Delete old images from S3 if they exist and are not in the new images
//       const imagesToDelete = existingImages.filter(
//         (url) =>
//           !newImages.some(
//             (image) => image.originalname === url.split("/").pop()
//           )
//       );

//       for (const oldImageUrl of imagesToDelete) {
//         const oldImageKey = oldImageUrl.split("/").pop(); // Extract the key from the URL
//         await deleteFile(process.env.BUCKET_NAME, oldImageKey); // Delete from S3
//       }

//       // Upload new images to S3
//       const imageUploadPromises = newImages.map((image) => {
//         const imageKey = image.originalname; // Use the original file name as the key
//         return uploadFile(
//           process.env.BUCKET_NAME,
//           imageKey,
//           image.path,
//           image.mimetype
//         ).then(() => `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${imageKey}`);
//       });

//       const uploadedImageUrls = await Promise.all(imageUploadPromises);

//       // Log the uploaded image URLs
//       console.log("Uploaded Image URLs: ", uploadedImageUrls);

//       // Update images array with new S3 URLs
//       existingProject.images = [
//         ...existingImages.filter((url) => !imagesToDelete.includes(url)), // Keep existing images that were not deleted
//         ...uploadedImageUrls // Add new image URLs from S3
//       ];

//       // Handle video updates
//       const video = req.files["video"] ? req.files["video"][0] : null;
//       if (video) {
//         // Delete the old video from S3 if it exists
//         if (existingProject.video) {
//           const oldVideoKey = existingProject.video.split("/").pop();
//           await deleteFile(process.env.BUCKET_NAME, oldVideoKey); // Delete from S3
//         }

//         // Upload the new video to S3
//         const videoKey = video.originalname;
//         await uploadFile(
//           process.env.BUCKET_NAME,
//           videoKey,
//           video.path,
//           video.mimetype
//         );
//         existingProject.video = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${videoKey}`;
//       }

//       // Save the updated project
//       const updatedProject = await existingProject.save();
//       res.status(200).json(updatedProject);
//     } catch (error) {
//       console.error("Error updating project:", error); // Log error for debugging
//       res.status(400).json({ message: error.message });
//     }
//   }
// );

module.exports = router;
