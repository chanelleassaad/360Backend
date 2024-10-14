const mongoose = require("mongoose");

const statSchema = new mongoose.Schema({
  _id: {type: mongoose.Schema.Types.ObjectId, auto: true },
  title: { type: String, required: true },
  description: { type: String, required: true }
}, { collection: 'stats' });

const Stat = mongoose.model("Stat", statSchema);

module.exports = Stat;
