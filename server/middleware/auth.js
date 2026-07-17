/**
 * server/middleware/auth.js
 * JWT Authentication middleware.
 * Verifies the token from httpOnly cookie and attaches user to req.
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  // Extract token from httpOnly cookie (primary) or Authorization header (fallback)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized. Please log in." });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request (exclude password)
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ success: false, message: "User no longer exists." });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token. Please log in again." });
  }
};

module.exports = { protect };
