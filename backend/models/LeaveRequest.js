const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["mutua", "pir", "ferie"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "approved",
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
      index: true,
    },
    hours: {
      type: Number,
      default: null,
    },
    startTime: {
      type: String,
      default: null,
    },
    endTime: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

leaveRequestSchema.index(
  { user: 1, type: 1, date: 1, status: 1 },
  { name: "user_type_date_status_idx" }
);

leaveRequestSchema.index(
  { user: 1, type: 1, startDate: 1, endDate: 1, status: 1 },
  { name: "user_type_start_end_status_idx" }
);

module.exports =
  mongoose.models.LeaveRequest ||
  mongoose.model("LeaveRequest", leaveRequestSchema);
