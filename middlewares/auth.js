// middlewares/auth.js
import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  try {
    console.log("Token received:", token); // Debugging
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Remove 'iat' if not needed
    delete decoded.iat;

    // Pass decoded token to next middleware
    req.user = decoded;

    next(); // Proceed
  } catch (err) {
    console.error("Token verification error:", err); // Debugging
    return res.status(400).json({ message: "Invalid token", err });
  }
};

export default auth;
