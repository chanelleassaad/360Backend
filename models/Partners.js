const mongoose = require("mongoose");

const PartnerSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    fullName: { type: String, required: true },
    quote: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
  },
  { collection: "partners", versionKey: false }
);

module.exports = mongoose.model("Partner", PartnerSchema);
