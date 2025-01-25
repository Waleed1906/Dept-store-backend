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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    // Remove 'iat' from decoded token if needed
    delete decoded.iat;

   
    
    // You can pass the modified decoded token to the next middleware/route handler
    req.user = decoded;

    next(); // Proceed to the next middleware or route
  } catch (err) {
    console.error("Token verification error:", err); // Add this line for debugging
    return res.status(400).json({ message: "Invalid token", err });
  }
};
