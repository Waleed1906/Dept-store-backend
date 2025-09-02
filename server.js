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
const cors = require('cors');
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2; // Import Cloudinary
const user = require("./models/user")
const Order = require("./models/order")
const Product = require("./models/products")
const Chat = require("./models/Chat")
// Initialize Express app
const app = express();
dotenv.config();
app.use(cors());

// Middleware setup

// Use JSON parser for all routes EXCEPT webhook
app.use('/api/auth/stripe', bodyParser.raw({ type: 'application/json' }));
app.use(express.json());
// MongoDB connection (updated for v4+)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Use Routes
app.use("/api/auth", authRoutes);




// Root route
app.get("/", (req, res) => {
  res.send(
    "Ahmad Yaseen-BSCS-F20-378,Muhammad Ahmad-BSCS-F20-283"
  );
});

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Your Cloudinary cloud name
  api_key: process.env.CLOUDINARY_API_KEY, // Your Cloudinary API key
  api_secret: process.env.CLOUDINARY_API_SECRET, // Your Cloudinary API secret
});

// Set up Cloudinary storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "product_images", // Cloudinary folder where images will be saved
    format: async (req, file) => path.extname(file.originalname).substring(1), // Automatically determine the file format
    public_id: (req, file) => `${file.fieldname}_${Date.now()}`, // Set file name
  },
});

const upload = multer({ storage: storage });

// Upload endpoint for images
app.post("/upload", upload.single("product"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Image upload failed" });
  }

  // Cloudinary URL is automatically provided by req.file.path
  res.json({
    success: 1,
    image_url: req.file.path, // Cloudinary URL for the uploaded image
  });
});



// Add Product Endpoint
app.post("/addproduct", async (req, res) => {
  try {
    let last_product = await Product.findOne().sort({ id: -1 });
    let id = last_product ? last_product.id + 1 : 1;

    const product = new Product({
      id: id,
      name: req.body.name,
      image: req.body.image,
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

    // Find the product to get the image URL
    const deletedProduct = await Product.findOneAndDelete({ id: productId });
    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Extract the public ID from the Cloudinary image URL
    const imageUrl = deletedProduct.image;
    const publicId = imageUrl.split('/').pop().split('.')[0]; // Extract the public ID from the URL

    // Delete the image from Cloudinary
    await cloudinary.uploader.destroy(`product_images/${publicId}`, (error, result) => {
      if (error) {
        console.error("Cloudinary image deletion error:", error);
        return res.status(500).json({
          success: false,
          message: "Error deleting image from Cloudinary",
        });
      }
      console.log("Image deleted from Cloudinary:", result);
    });

    console.log("Product and image removed:", deletedProduct);
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
    let products = await Product.find({}).sort({ date: -1 });

    let latestItemsByCategory = new Map();

    products.forEach((product) => {
      if (!latestItemsByCategory.has(product.category)) {
        latestItemsByCategory.set(product.category, product);
      }
    });

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
// Endpoint for Add to Cart save data to MongoDB
app.post("/addtocart", auth, async (req, res) => {
  console.log("Added",req.body.itemId);
  let userData = await user.findOne({_id:req.user.id});
  userData.cartData[req.body.itemId] += 1;
  await user.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
  res.send("Added")

})

// Endpoint for Remove from Cart save data to MongoDB
app.post("/removetocart", auth, async (req, res) => {
  console.log("removed",req.body.itemId);
  let userData = await user.findOne({_id:req.user.id});
  if(userData.cartData[req.body.itemId]>0)
  userData.cartData[req.body.itemId] = 0;
  await user.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
  res.send("Removed")

})
// Enpoint to get Cartdata

app.post("/getcart", auth, async (req, res) => {
  console.log("GetCart");
  let userData = await user.findOne({_id:req.user.id});
  res.json(userData.cartData);

})
// Endpoint for Add to Cart save data to MongoDB
app.post("/updatecart", auth, async (req, res) => {
  try {
    const { itemId, quantity } = req.body;

    // Find the user by their ID
    let userData = await user.findOne({ _id: req.user.id });
    
    // Ensure cartData exists
    if (!userData.cartData) {
      return res.status(400).json({ message: "Cart data not found." });
    }

    // Check if the item exists in the cart
    if (!(itemId in userData.cartData)) {
      return res.status(404).json({ message: "Item not found in the cart." });
    }

    // Update the item's quantity in the cart
    userData.cartData[itemId] = quantity;

    // Save the updated cart data to the database
    await user.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });

    res.json({ message: "Cart updated successfully." });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Server error. Unable to update cart." });
  }
});

//Endpoint to Create Order 
app.post("/create-order", auth, async (req, res) => {
  try {
    // Get user info from JWT
    const userId = req.user.id;
   // Fetch email from database
    const userData = await user.findById(userId).select("email");
    if (!userData) return res.status(404).json({ message: "User not found" });

    

    // Extract order info from request body
    const { address, phoneNumber, paymentMethod, paymentStatus, orderData, total,fullName } = req.body;

    // Create new order
    const newOrder = new Order({
      userId: userId,
      fullName: fullName,
      email: userData.email,
      address: address,
      phoneNumber: phoneNumber,
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      orderData: orderData,
      total: total,
      paymentIntentId: paymentMethod === "Card" ? req.body.paymentIntentId : null
    });

    await newOrder.save();

    res.status(201).json({ message: "Order created successfully", order: newOrder });
    // Reset user's cart in DB to default (empty)
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

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
