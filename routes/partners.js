const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const express = require("express");
const router = express.Router();
const dotenv = require("dotenv");

dotenv.config();

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
  region: process.env.BUCKET_REGION,
});

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const Partner = require("../models/Partners");

const fs = require("fs");
const util = require("util");
const unlinkFile = util.promisify(fs.unlink); // To delete the file after upload

/**
 * @swagger
 * /api/partners/getPartners:
 *   get:
 *     summary: Get all partners
 *     tags: [Partners]
 *     responses:
 *       200:
 *         description: A list of partners
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   fullName:
 *                     type: string
 *                   quote:
 *                     type: string
 *                   description:
 *                     type: string
 *                   imageUrl:
 *                     type: string
 *
 *       500:
 *         description: Server error
 */
router.get("/getPartners", async (req, res) => {
  try {
    const partners = await Partner.find();
    res.status(200).json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/partners/addPartner:
 *   post:
 *     summary: Create a new partner
 *     tags: [Partners]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *                   fullName:
 *                     type: string
 *                   quote:
 *                     type: string
 *                   description:
 *                     type: string
 *                   image:
 *                     type: string
 *                     format: binary
 *     responses:
 *       201:
 *         description: Partner created successfully
 *       400:
 *         description: Invalid input
 */
router.post("/addPartner", upload.single("image"), async (req, res) => {
  const { fullName, quote, description } = req.body;

  console.log(req);

  // Ensure that the image file is provided
  if (!req.file) {
    return res.status(400).json({ message: "Image is required" });
  }

  // Create the file stream
  const fileStream = fs.createReadStream(req.file.path);

  // Parameters for uploading to S3
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: req.file.originalname, // You may want to consider a more unique key
    Body: fileStream,
    ContentType: req.file.mimetype,
  };

  try {
    // Upload the file to S3
    const command = new PutObjectCommand(params);
    await s3.send(command);

    // Create a new Partner instance
    const partner = new Partner({
      fullName,
      quote,
      description,
      imageUrl: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${req.file.originalname}`, // Set the S3 image URL
    });

    // Save the partner to the database
    const savedPartner = await partner.save();

    // Remove the file from local storage after upload
    await unlinkFile(req.file.path);

    // Send back the saved partner
    res.status(201).json(savedPartner);
  } catch (error) {
    // Log error and return response
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while saving the partner" });
  }
});

/**
 * @swagger
 * /api/partners/deletePartner/{id}:
 *   delete:
 *     summary: Delete a partner by ID
 *     tags: [Partners]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The partner ID
 *     responses:
 *       200:
 *         description: Partner deleted successfully
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Server error
 */

router.delete("/deletePartner/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find the partner by ID
    const partner = await Partner.findById(id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Extract the S3 key from the image URL
    const imageUrl = partner.imageUrl;
    const imageKey = imageUrl.split("/").pop(); // This assumes the image URL is formatted correctly

    // Delete the image from S3
    const deleteParams = {
      Bucket: process.env.BUCKET_NAME,
      Key: imageKey,
    };

    const deleteCommand = new DeleteObjectCommand(deleteParams);
    await s3.send(deleteCommand);

    // Now delete the partner from the database
    await Partner.findByIdAndDelete(id);

    res
      .status(200)
      .json({ message: "Partner and associated image deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/partners/editPartner/{id}:
 *   put:
 *     summary: Update a partner by ID
 *     tags: [Partners]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The partner ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               quote:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Partner updated successfully
 *       404:
 *         description: Partner not found
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.put("/editPartner/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;

  try {
    // Retrieve the existing partner
    const existingPartner = await Partner.findById(id);
    if (!existingPartner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Update fields only if provided in the request body
    if (req.body.fullName !== undefined)
      existingPartner.fullName = req.body.fullName;
    if (req.body.quote !== undefined) existingPartner.quote = req.body.quote;
    if (req.body.description !== undefined)
      existingPartner.description = req.body.description;

    // Handle image update if a new image is uploaded
    if (req.file) {
      // Extract the current image key from the existing URL
      const oldImageUrl = existingPartner.imageUrl;
      const oldImageKey = oldImageUrl.split("/").pop();

      // Delete the old image from S3
      const deleteParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: oldImageKey,
      };
      const deleteCommand = new DeleteObjectCommand(deleteParams);
      await s3.send(deleteCommand);

      // Upload the new image to S3
      const fileStream = fs.createReadStream(req.file.path);
      const uploadParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: req.file.originalname, // Ensure uniqueness in production
        Body: fileStream,
        ContentType: req.file.mimetype,
      };

      const uploadCommand = new PutObjectCommand(uploadParams);
      await s3.send(uploadCommand);

      // Update the image URL with the new image
      existingPartner.imageUrl = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${req.file.originalname}`;

      // Remove the local file after upload
      await unlinkFile(req.file.path);
    }

    // Save the updated partner
    const updatedPartner = await existingPartner.save();
    res.status(200).json(updatedPartner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
