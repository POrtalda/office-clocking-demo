const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

console.log("ENV PATH:", path.resolve(__dirname, "../.env"));
console.log("MONGO_URI:", process.env.MONGO_URI);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connesso");

    // Utenti da creare
    const usersToSeed = [
      { username: "admin", password: "1234", role: "admin" },
      { username: "mario", password: "1234", role: "user" },
      { username: "luca", password: "1234", role: "user" },
    ];

    for (const u of usersToSeed) {
      const username = u.username.trim().toLowerCase();

      const existing = await User.findOne({ username });
      if (existing) {
        console.log(`ℹ️ Esiste già: ${username}`);
        continue;
      }

      const hashed = await bcrypt.hash(u.password, 10);

      await User.create({
        username,
        password: hashed,
        role: u.role,
      });

      console.log(`✅ Creato: ${username} (${u.role})`);
    }

    console.log("🎉 Seed completato");
  } catch (err) {
    console.error("❌ Seed error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
