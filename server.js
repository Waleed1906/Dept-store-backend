// server.js
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
const { v2: cloudinary } = require("cloudinary");
const user = require("./models/user");
const Order = require("./models/order");
const Product = require("./models/products");
const Chat = require("./models/Chat");
const ChatHistory = require("./routes/ChatHistory")


dotenv.config();
const app = express();
app.use(cors());

// Middleware setup
app.use("/api/auth/stripe", bodyParser.raw({ type: "application/json" }));
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
//ChatHistory Route 
app.use("/chat", ChatHistory);

// Root route
app.get("/", (req, res) => {
  res.send(
    "Ahmad Yaseen-BSCS-F20-378,Muhammad Ahmad-BSCS-F20-283"
  );
});

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "product_images",
    format: async (req, file) => path.extname(file.originalname).substring(1),
    public_id: (req, file) => `${file.fieldname}_${Date.now()}`,
  },
});

const upload = multer({ storage });

// Upload endpoint
app.post("/upload", upload.single("product"), (req, res) => {
  if (!req.file)
    return res
      .status(400)
      .json({ success: false, message: "Image upload failed" });
  res.json({ success: 1, image_url: req.file.path });
});

// Add Product
app.post("/addproduct", async (req, res) => {
  try {
    const last_product = await Product.findOne().sort({ id: -1 });
    const id = last_product ? last_product.id + 1 : 1;
    const product = new Product({ id, ...req.body });
    const savedProduct = await product.save();
    res.json({ success: true, product: savedProduct });
  } catch (error) {
    console.error("Error saving product:", error);
    res
      .status(500)
      .json({ success: false, message: error.message });
  }
});

// Remove Product
app.post("/removeproduct/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId)
      return res
        .status(400)
        .json({ success: false, message: "Product ID is missing" });

    const deletedProduct = await Product.findOneAndDelete({ id: productId });
    if (!deletedProduct)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const imageUrl = deletedProduct.image;
    const publicId = imageUrl.split("/").pop().split(".")[0];

    await cloudinary.uploader.destroy(
      `product_images/${publicId}`,
      (error, result) => {
        if (error) console.error("Cloudinary image deletion error:", error);
        else console.log("Image deleted from Cloudinary:", result);
      }
    );

    res.json({
      success: true,
      message: "Product removed successfully",
      name: deletedProduct.name,
    });
  } catch (error) {
    console.error("Error removing product:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error occurred while removing the product" });
  }
});

// All Products
app.get("/allproducts", async (req, res) => {
  try {
    const products = await Product.find({});
    console.log("All Products Fetched");
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching products" });
  }
});

// Latest Items
app.get("/LatestItems", async (req, res) => {
  try {
    const products = await Product.find({}).sort({ date: -1 });
    const latestItemsByCategory = new Map();
    products.forEach((p) => {
      if (!latestItemsByCategory.has(p.category))
        latestItemsByCategory.set(p.category, p);
    });
    res.json(Array.from(latestItemsByCategory.values()));
  } catch (error) {
    console.error("Error fetching latest items:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching latest items" });
  }
});

// Popular Vegetables
app.get("/popularinvegetables", async (req, res) => {
  try {
    const products = await Product.find({ category: "Fruits_Vegetables" });
    res.json(products.slice(0, 3));
  } catch (error) {
    console.error("Error fetching popular vegetables:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching popular vegetables" });
  }
});

// New Products
app.get("/newproducts", async (req, res) => {
  try {
    const newproducts = await Product.find().sort({ date: -1 }).limit(8);
    res.json(newproducts);
  } catch (error) {
    console.error("Error fetching new products:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching new products" });
  }
});

// Cart Endpoints
app.post("/addtocart", auth, async (req, res) => {
  const userData = await user.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await user.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Added");
});

app.post("/removetocart", auth, async (req, res) => {
  const userData = await user.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0) userData.cartData[req.body.itemId] = 0;
  await user.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Removed");
});

app.post("/getcart", auth, async (req, res) => {
  const userData = await user.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

app.post("/updatecart", auth, async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    const userData = await user.findOne({ _id: req.user.id });
    if (!userData.cartData) return res.status(400).json({ message: "Cart data not found." });
    if (!(itemId in userData.cartData)) return res.status(404).json({ message: "Item not found in the cart." });
    userData.cartData[itemId] = quantity;
    await user.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.json({ message: "Cart updated successfully." });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Server error. Unable to update cart." });
  }
});

// Create Order
app.post("/create-order", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userData = await user.findById(userId).select("email");
    if (!userData) return res.status(404).json({ message: "User not found" });

    const { address, phoneNumber, paymentMethod, paymentStatus, orderData, total, fullName } = req.body;
    const newOrder = new Order({
      userId,
      fullName,
      email: userData.email,
      address,
      phoneNumber,
      paymentMethod,
      paymentStatus,
      orderData,
      total,
      paymentIntentId: paymentMethod === "Card" ? req.body.paymentIntentId : null,
    });

    await newOrder.save();
    res.status(201).json({ message: "Order created successfully", order: newOrder });

    // Reset cart
    const emptyCart = {};
    for (let i = 1; i <= 300; i++) emptyCart[i] = 0;
    await user.findByIdAndUpdate(userId, { cartData: emptyCart });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Dear Customer You already placed ordered with Same Payment Method" });
  }
});

// Protected Route Example
app.get("/api/auth/protected", auth, (req, res) => {
  res.status(200).json({ message: "Token is valid", user: req.user });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
