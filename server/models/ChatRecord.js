const mongoose = require("mongoose");

const chatRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    sender: {
      type: String,
      enum: ["user", "ai"],
      required: true,
    },
    type: {
      type: String,
      enum: ["chat", "meal"],
      default: "chat",
    },
    data: {
      type: mongoose.Schema.Types.Mixed, // Store analyzed food data if type is meal
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatRecord", chatRecordSchema);
