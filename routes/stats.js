const express = require("express");
const Stats = require("../models/Stats");
const Stat = require("../models/Stats");
const router = express.Router();
const requireAuths = require("../middlewares/requireAuths");

/**
 * @swagger
 * /api/stats/getStats:
 *   get:
 *     summary: Get all stats
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: A list of stats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *
 *       500:
 *         description: Server error
 */
router.get("/getStats", async (req, res) => {
  try {
    const stats = await Stats.find();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/stats/addStats:
 *   post:
 *     summary: Create a new stats
 *     tags: [Stats]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *     responses:
 *       201:
 *         description: Stat created successfully
 *       400:
 *         description: Invalid input
 */
router.post("/addStats", requireAuths, async (req, res) => {
  const { title, description } = req.body;

  const stat = new Stat({
    title,
    description,
  });

  try {
    const savedStat = await stat.save();
    res.status(201).json(savedStat);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/stats/deleteStat/{id}:
 *   delete:
 *     summary: Delete a stat by ID
 *     tags: [Stats]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The stat ID
 *     responses:
 *       200:
 *         description: Stat deleted successfully
 *       404:
 *         description: Stat not found
 *       500:
 *         description: Server error
 */
router.delete("/deleteStat/:id", requireAuths, async (req, res) => {
  try {
    const { id } = req.params;
    const stat = await Stat.findByIdAndDelete(id);

    if (!stat) {
      return res.status(404).json({ message: "Stat not found" });
    }

    res.status(200).json({ message: "Stat deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/stats/editStat/{id}:
 *   put:
 *     summary: Update a stat by ID
 *     tags: [Stats]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The stat ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stat updated successfully
 *       404:
 *         description: Stat not found
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.put("/editStat/:id", requireAuths, async (req, res) => {
  const { id } = req.params;

  try {
    // Retrieve the existing stat
    const existingStat = await Stat.findById(id);
    if (!existingStat) {
      return res.status(404).json({ message: "Stat not found" });
    }

    // Update fields only if provided in the request body
    if (req.body.title !== undefined) existingStat.title = req.body.title;
    if (req.body.description !== undefined)
      existingStat.description = req.body.description;
    // Save the updated stat
    const updatedStat = await existingStat.save();
    res.status(200).json(updatedStat);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
