
const express = require("express");
const User = require("../models/User");

const router = express.Router();

router.get("/login-users", async (req, res) => {
  if (process.env.DEMO_MODE !== "true") {
    return res.status(404).json({ message: "Route non trovata." });
  }

  try {
    const users = await User.find({ isActive: { $ne: false } })
      .select("username name surname role")
      .sort({ role: 1, name: 1, username: 1 })
      .lean();

    return res.json({
      users: users.map((user) => ({
        username: user.username,
        name: user.name,
        surname: user.surname,
        role: user.role,
      })),
    });
  } catch (error) {
    console.error("Errore recupero utenti demo login:", error);

    return res.status(500).json({
      message: "Errore nel recupero degli utenti demo.",
    });
  }
});

module.exports = router;
