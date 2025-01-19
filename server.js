const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const authRoutes = require("./routes/auth");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const auth = require("./middlewares/auth");
const cors = require("cors");
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const uploadDir = path.join(__dirname, "uploads");
const user = require("./models/user");

// Initialize Express app
const app = express();
dotenv.config();
app.use(cors());

// Middleware setup
app.use(express.json());
app.use(bodyParser.json());
// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Multer-Cloudinary storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "products", // Folder name in Cloudinary where images will be stored
    format: async (req, file) => "png", // Supports jpg, png, etc.
    public_id: (req, file) => `${file.fieldname}_${Date.now()}`, // Unique public ID for each image
  },
});

const upload = multer({ storage: storage });

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// Use Routes
app.use("/api/auth", authRoutes); // Only keep one route for auth

// Root route
app.get("/", (req, res) => {
  res.send(
    "AhsanAli-BSCS-F20-280,AbdullahRabi-BSCS-F20-316,WaleedJaved-BSCS-F20-337"
  );
});







// Product Schema
const Product = mongoose.model("product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});

/// Add product with image upload to Cloudinary
app.post("/addproduct", upload.single("product"), async (req, res) => {
  try {
    let last_product = await Product.findOne().sort({ id: -1 });
    let id = last_product ? last_product.id + 1 : 1;

    const product = new Product({
      id: id,
      name: req.body.name,
      image: req.file.path, // Use the Cloudinary URL for the image
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price,
    });

    const savedProduct = await product.save();

    res.json({
      success: true,
      product: savedProduct,
    });
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Delete Product Endpoint
app.post("/removeproduct/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is missing",
      });
    }

    const deletedProduct = await Product.findOneAndDelete({ id: productId });
    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    console.log("Removed", deletedProduct);
    res.json({
      success: true,
      message: "Product removed successfully",
      name: deletedProduct.name,
    });
  } catch (error) {
    console.error("Error removing product:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while removing the product",
    });
  }
});

// Get all products
app.get("/allproducts", async (req, res) => {
  try {
    let products = await Product.find({});
    console.log("All Products Fetched");
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products",
    });
  }
});

// Endpoint for Our Latest Items (one latest item per category)
app.get("/LatestItems", async (req, res) => {
  try {
    // Fetch all products and sort by date in descending order
    let products = await Product.find({}).sort({ date: -1 });

    // Create a map to hold the latest product for each category
    let latestItemsByCategory = new Map();

    // Iterate through products and store only one product per category
    products.forEach((product) => {
      if (!latestItemsByCategory.has(product.category)) {
        latestItemsByCategory.set(product.category, product);
      }
    });

    // Convert the map values to an array to send in the response
    let latestItems = Array.from(latestItemsByCategory.values());

    console.log("Latest Items by Category Fetched");
    res.json(latestItems);
  } catch (error) {
    console.error("Error fetching latest items:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching latest items",
    });
  }
});

// Endpoint for Popular in Fruits and Vegetables
app.get("/popularinvegetables", async (req, res) => {
  try {
    let products = await Product.find({ category: "Fruits_Vegetables" });
    let popularinvegetables = products.slice(0, 3);
    console.log("Popular in Fruits and Vegetables Fetched");
    res.json(popularinvegetables);
  } catch (error) {
    console.error("Error fetching popular vegetables:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching popular vegetables",
    });
  }
});

// Get new products
app.get("/newproducts", async (req, res) => {
  try {
    let newproducts = await Product.find().sort({ date: -1 }).limit(8);
    console.log("New Products Fetched");
    res.json(newproducts);
  } catch (error) {
    console.error("Error fetching new products:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching new products",
    });
  }
});

// Protected Route Example
app.get("/api/auth/protected", auth, (req, res) => {
  res.status(200).json({ message: "Token is valid", user: req.user });
});

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
