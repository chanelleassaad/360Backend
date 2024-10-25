const express = require("express");
const Box = require("../models/Box");
const router = express.Router();

/**
 * @swagger
 * /api/box/getBoxDescription:
 *   get:
 *     summary: Get the box description
 *     tags: [Box]
 *     responses:
 *       200:
 *         description: A list of descriptions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   description:
 *                     type: string
 *       500:
 *         description: Server error
 */
router.get("/getBoxDescription", async (req, res) => {
  try {
    const box = await Box.find();
    res.status(200).json(box);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/box/updateBoxDescription/{id}:
 *   put:
 *     summary: Update the box description
 *     tags: [Box]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated box description
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 description:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.put("/updateBoxDescription", async (req, res) => {
  try {
    const { description } = req.body;

    // Find the first box and update the description
    const updatedBox = await Box.findOneAndUpdate(
      {}, // Empty filter to match the first box found
      { description },
      { new: true, runValidators: true }
    );

    if (!updatedBox) {
      return res.status(404).json({ message: "Box not found" });
    }

    res.status(200).json(updatedBox);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
