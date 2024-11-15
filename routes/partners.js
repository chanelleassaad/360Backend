const express = require("express");
const router = express.Router();
const multer = require("multer");
const Partner = require("../models/Partners");
const { uploadFile, deleteFile } = require("../services/s3Service"); // Adjust the path as needed
const requireAuths = require("../middlewares/requireAuths");
const upload = multer({ dest: "uploads/" });

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
router.post(
  "/addPartner",
  requireAuths,
  upload.single("image"),
  async (req, res) => {
    const { fullName, quote, description } = req.body;

    // Ensure that the image file is provided
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    try {
      // Upload the file to S3
      const imageKey = req.file.originalname; // You may want to consider a more unique key
      await uploadFile(
        process.env.BUCKET_NAME,
        imageKey,
        req.file.path,
        req.file.mimetype
      );

      // Create a new Partner instance
      const partner = new Partner({
        fullName,
        quote,
        description,
        imageUrl: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${imageKey}`, // Set the S3 image URL
      });

      // Save the partner to the database
      const savedPartner = await partner.save();

      // Send back the saved partner
      res.status(201).json(savedPartner);
    } catch (error) {
      // Log error and return response
      console.error(error);
      res
        .status(500)
        .json({ message: "An error occurred while saving the partner" });
    }
  }
);

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
router.delete("/deletePartner/:id", requireAuths, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the partner by ID
    const partner = await Partner.findById(id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Extract the S3 key from the image URL
    const imageKey = partner.imageUrl.split("/").pop(); // This assumes the image URL is formatted correctly

    // Delete the image from S3
    await deleteFile(process.env.BUCKET_NAME, imageKey);

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
router.put(
  "/editPartner/:id",
  requireAuths,
  upload.single("image"),
  async (req, res) => {
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
        const oldImageKey = oldImageUrl ? oldImageUrl.split("/").pop() : null;

        // Delete the old image from S3 if it exists
        if (oldImageKey) {
          await deleteFile(process.env.BUCKET_NAME, oldImageKey);

          // Upload the new image to S3
          const newImageKey = req.file.originalname; // Ensure uniqueness in production
          await uploadFile(
            process.env.BUCKET_NAME,
            newImageKey,
            req.file.path,
            req.file.mimetype
          );

          // Update the image URL with the new image
          existingPartner.imageUrl = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${newImageKey}`;
        }
      }

      // Save the updated partner
      const updatedPartner = await existingPartner.save();
      res.status(200).json(updatedPartner);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
