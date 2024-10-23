const express = require("express");
const router = express.Router();
const { S3Client, PutObjectCommand, DeleteObjectCommand , ListObjectsV2Command } = require("@aws-sdk/client-s3");

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

const multer = require("multer");
// Multer setup for handling file uploads
const upload = multer({ dest: 'uploads/' });

/**
 * @swagger
 * /api/image/uploadFile:
 *   post:
 *     summary: Upload a file to S3 (images only)
 *     tags: [Images]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Image uploaded successfully
 *       400:
 *         description: Invalid file type (only images allowed)
 *       500:
 *         description: Internal server error
 */
router.post("/uploadFile", upload.single('file'), async (req, res) => {
    try {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp']; // Add other image formats if needed

        console.log("req body", req.body);
        console.log("req file", req.file);

        // Check if the uploaded file is an image based on its MIME type
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).send({ message: "Invalid file type. Only images are allowed." });
        }

        const fs = require('fs');
        const fileStream = fs.createReadStream(req.file.path); // This replaces req.file.buffer

        const params = {
            Bucket: bucketName,
            Key: req.file.originalname,
            Body: fileStream,
            ContentType: req.file.mimetype,
        };
        
        const command = new PutObjectCommand(params);
        await s3.send(command);

        res.status(201).send({ message: "Image uploaded successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal server error" });
    }
});

// Get all images from the S3 bucket
/**
 * @swagger
 * /api/image/getAllImages:
 *   get:
 *     summary: Get all images from S3
 *     tags: [Images]
 *     responses:
 *       200:
 *         description: A list of all image URLs
 *       500:
 *         description: Internal server error
 */
router.get("/getAllImages", async (req, res) => {
    try {
        const params = {
            Bucket: bucketName,
        };

        const command = new ListObjectsV2Command(params);
        const data = await s3.send(command);

        // If there are no objects in the bucket
        if (!data.Contents || data.Contents.length === 0) {
            return res.status(200).send({ message: "No images found", images: [] });
        }

        // Filter and generate URLs for image files only (extensions like .jpg, .png, etc.)
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']; // Add other image formats if needed

        const images = data.Contents.filter((item) => {
            const extension = item.Key.slice(item.Key.lastIndexOf('.')).toLowerCase();
            return imageExtensions.includes(extension); // Only include files with image extensions
        }).map((item) => {
            return `https://${bucketName}.s3.${bucketRegion}.amazonaws.com/${item.Key}`;
        });

        res.status(200).send({ message: "Images retrieved successfully", images });
    } catch (error) {
        console.error("Error fetching images from S3: ", error);
        res.status(500).send({ message: "Internal server error" });
    }
});


// Delete an image from S3
/**
 * @swagger
 * /api/image/deleteFile:
 *   delete:
 *     summary: Delete an image from S3 by its key
 *     tags: [Images]
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         description: The S3 key (filename) of the image to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       400:
 *         description: Bad request, image key not provided
 *       500:
 *         description: Internal server error
 */
router.delete("/deleteFile", async (req, res) => {
    const { key } = req.query; // Get the image key (filename) from the query parameter

    if (!key) {
        return res.status(400).send({ message: "Image key is required" });
    }

    try {
        const params = {
            Bucket: bucketName,
            Key: key, // The key of the object to delete
        };

        const command = new DeleteObjectCommand(params);
        await s3.send(command);

        res.status(200).send({ message: `Image '${key}' deleted successfully` });
    } catch (error) {
        console.error("Error deleting image from S3: ", error);
        res.status(500).send({ message: "Internal server error" });
    }
});

/**
 * @swagger
 * /api/image/updateFile:
 *   put:
 *     summary: Update an existing image in S3
 *     tags: [Images]
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         description: The S3 key (filename) of the image to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image updated successfully
 *       400:
 *         description: Invalid file type (only images allowed)
 *       404:
 *         description: Image not found
 *       500:
 *         description: Internal server error
 */
router.put("/updateFile", upload.single('file'), async (req, res) => {
    const { key } = req.query; // Get the image key (filename) from the query parameter

    if (!key) {
        return res.status(400).send({ message: "Image key is required" });
    }

    try {
        // Validate the file type (same as in the upload endpoint)
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).send({ message: "Invalid file type. Only images are allowed." });
        }

        // Delete the old image from S3
        const deleteParams = {
            Bucket: bucketName,
            Key: key, // Use the existing key to delete the old image
        };

        const deleteCommand = new DeleteObjectCommand(deleteParams);
        await s3.send(deleteCommand);

        // Upload the new image to S3 with the same key (replacing the old one)
        const fs = require('fs');
        const fileStream = fs.createReadStream(req.file.path);

        const uploadParams = {
            Bucket: bucketName,
            Key: key, // Reuse the same key
            Body: fileStream,
            ContentType: req.file.mimetype,
        };

        const uploadCommand = new PutObjectCommand(uploadParams);
        await s3.send(uploadCommand);

        res.status(200).send({ message: `Image '${key}' updated successfully` });
    } catch (error) {
        console.error("Error updating image in S3: ", error);
        res.status(500).send({ message: "Internal server error" });
    }
});


module.exports = router;
