const mongoose = require("mongoose");

const appSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    leaveMinAdvanceDays: {
      type: Number,
      required: true,
      default: 2,
      min: 0,
      max: 365,
    },
    leaveNotificationEmails: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppSettings", appSettingsSchema);
