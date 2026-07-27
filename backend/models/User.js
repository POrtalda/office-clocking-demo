// import di mongoose per definire lo schema del modello User
const mongoose = require("mongoose");

// definisco la struttura del documento 'User'
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    geolocationEnabled: {
      type: Boolean,
      default: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Creo un modello chiamato "User" usando userSchema.
module.exports = mongoose.model("User", userSchema);