const express = require("express");
const router = express.Router();
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");

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
 *     summary: Upload a file to S3
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
 *         description: File uploaded successfully
 *       500:
 *         description: Internal server error
 */
router.post("/uploadFile", upload.single('file'), async (req, res) => {
    try {
        console.log("req body", req.body);
        console.log("req file", req.file);

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

        res.status(201).send({ message: "File uploaded successfully" });
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

        // If there are no images in the bucket
        if (!data.Contents || data.Contents.length === 0) {
            return res.status(200).send({ message: "No images found", images: [] });
        }

        // Generate the URLs for the images
        const images = data.Contents.map((item) => {
            return `https://${bucketName}.s3.${bucketRegion}.amazonaws.com/${item.Key}`;
        });

        res.status(200).send({ message: "Images retrieved successfully", images });
    } catch (error) {
        console.error("Error fetching images from S3: ", error);
        res.status(500).send({ message: "Internal server error" });
    }
});

module.exports = router;
