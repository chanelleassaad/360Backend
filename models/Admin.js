const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  _id: {type: mongoose.Schema.Types.ObjectId, auto: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true }
}, { collection: 'admin' });

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;
