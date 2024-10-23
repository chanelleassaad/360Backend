const express = require("express");
const router = express.Router();
const { S3Client, PutObjectCommand, DeleteObjectCommand , HeadObjectCommand ,ListObjectsV2Command } = require("@aws-sdk/client-s3");

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
 * /api/video/uploadVideo:
 *   post:
 *     summary: Upload a video to S3 (images only)
 *     tags: [Videos]
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
 *         description: video uploaded successfully
 *       400:
 *         description: Invalid file type (only images allowed)
 *       500:
 *         description: Internal server error
 */
router.post("/uploadVideo", upload.single('file'), async (req, res) => {
    try {
        const allowedVideoMimeTypes = [
            'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime', 
            'video/x-msvideo', 'video/x-matroska', 'video/3gpp', 'video/x-flv'
          ];

        // Check if the uploaded file is an image based on its MIME type
        if (!allowedVideoMimeTypes.includes(req.file.mimetype)) {
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

        res.status(201).send({ message: "video uploaded successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal server error" });
    }
});


/**
 * @swagger
 * /api/video/deleteVideo:
 *   delete:
 *     summary: Delete a video from S3 by its key
 *     tags: [Videos]
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         description: The S3 key (filename) of the video to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: video deleted successfully
 *       404:
 *         description: Video not found
 *       400:
 *         description: Bad request, video key not provided
 *       500:
 *         description: Internal server error
 */
router.delete("/deleteVideo", async (req, res) => {
    const { key } = req.query; // Get the video key (filename) from the query parameter

    if (!key) {
        return res.status(400).send({ message: "Video key is required" });
    }

    try {
        // First, check if the video exists in the S3 bucket
        const headParams = {
            Bucket: bucketName,
            Key: key,
        };

        try {
            const headCommand = new HeadObjectCommand(headParams);
            await s3.send(headCommand); // If this succeeds, the file exists
        } catch (err) {
            if (err.name === 'NotFound') {
                return res.status(404).send({ message: `Video '${key}' not found in S3 bucket` });
            }
            throw err; // Re-throw any other error
        }

        // If the video exists, proceed to delete it
        const deleteParams = {
            Bucket: bucketName,
            Key: key,
        };

        const deleteCommand = new DeleteObjectCommand(deleteParams);
        await s3.send(deleteCommand);

        res.status(200).send({ message: `Video '${key}' deleted successfully` });
    } catch (error) {
        console.error("Error deleting video from S3: ", error);
        res.status(500).send({ message: "Internal server error" });
    }
});

/**
 * @swagger
 * /api/video/updateFile:
 *   put:
 *     summary: Update an existing video in S3
 *     tags: [Videos]
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         description: The S3 key (filename) of the video to update
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
 *         description: Video updated successfully
 *       400:
 *         description: Invalid file type (only videos allowed)
 *       404:
 *         description: Video not found
 *       500:
 *         description: Internal server error
 */
router.put("/updateFile", upload.single('file'), async (req, res) => {
    const { key } = req.query; // Get the video key (filename) from the query parameter

    if (!key) {
        return res.status(400).send({ message: "Video key is required" });
    }

    try {
        // Validate the file type for video files
        const allowedVideoMimeTypes = [
            'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime', 
            'video/x-msvideo', 'video/x-matroska', 'video/3gpp', 'video/x-flv'
        ];
        
        if (!allowedVideoMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).send({ message: "Invalid file type. Only videos are allowed." });
        }

        // Delete the old video from S3
        const deleteParams = {
            Bucket: bucketName,
            Key: key, // Use the existing key to delete the old video
        };

        const deleteCommand = new DeleteObjectCommand(deleteParams);
        await s3.send(deleteCommand);

        // Upload the new video to S3 with the same key (replacing the old one)
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

        res.status(200).send({ message: `Video '${key}' updated successfully` });
    } catch (error) {
        console.error("Error updating video in S3: ", error);
        res.status(500).send({ message: "Internal server error" });
    }
});


module.exports = router;
