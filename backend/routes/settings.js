const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const AppSettings = require("../models/AppSettings");

const router = express.Router();

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global" } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      settings: {
        leaveMinAdvanceDays: settings.leaveMinAdvanceDays,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;