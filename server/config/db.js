/**
 * server/config/db.js
 * Mongoose connection to MongoDB Atlas.
 * Handles connection events and graceful shutdown.
 */

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Connection options for stability
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected. Reconnecting...");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err.message);
    });
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    console.error("👉 Check your MONGO_URI in .env file");
    process.exit(1); // Exit with failure code
  }
};

// Graceful shutdown on SIGTERM/SIGINT
const gracefulShutdown = async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed due to app termination");
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

module.exports = connectDB;
