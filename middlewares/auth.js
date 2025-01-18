const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  try {
    console.log("Token received:", token); // Add this line for debugging
    const decoded = jwt.verify(token, "abc");
    console.log(decoded,"dfdf")
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification error:", err); // Add this line for debugging
    return res.status(400).json({ message: "Invalid token", err });
  }
};

