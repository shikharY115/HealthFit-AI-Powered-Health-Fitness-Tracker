/**
 * server/index.js
 * Main entry point for the Express backend server.
 * Sets up middleware, routes, and starts listening.
 */

require("dotenv").config();
require("express-async-errors"); // Patches async errors into express error handler

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

// --- Route imports ---
const authRoutes = require("./routes/auth");
const bmiRoutes = require("./routes/bmi");
const calorieRoutes = require("./routes/calories");
const workoutRoutes = require("./routes/workouts");
const aiRoutes = require("./routes/ai");
const stepsRoutes = require("./routes/steps");

const app = express();
const PORT = process.env.PORT || 5000;

// --- Connect to MongoDB ---
connectDB();

// --- Global Rate Limiter (200 requests per 15 min per IP) ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: "Too many requests. Please try again later." },
});
app.use("/api", limiter);

// --- Strict Rate Limiter for AI and Search ---
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 mins for AI/Search
  message: { success: false, message: "Rate limit exceeded for AI/Search. Please try again later." },
});
app.use("/api/ai", strictLimiter);
app.use("/api/calories/search-food", strictLimiter);

// --- Core Middleware ---
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // Allow cookies to be sent
  })
);

// HTTP request logger (only in development)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// --- Health Check ---
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "HealthFit API is running 🏃", timestamp: new Date() });
});

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/bmi", bmiRoutes);
app.use("/api/calories", calorieRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/steps", stepsRoutes);

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// --- Global Error Handler ---
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 HealthFit Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || "development"}\n`);
});

module.exports = app;
