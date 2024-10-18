const mongoose = require("mongoose");

const boxSchema = new mongoose.Schema({
  _id: {type: mongoose.Schema.Types.ObjectId, auto: true },
  description: { type: String, required: true }
}, { collection: 'boxDescription' });

const Box = mongoose.model("Box", boxSchema);

module.exports = Box;
