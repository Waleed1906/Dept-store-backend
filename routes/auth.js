const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Order = require("../models/order");
const auth = require("../middlewares/auth");
const dotenv = require("dotenv");
const Stripe = require("stripe");

dotenv.config();
const router = express.Router();
const stripeClient = Stripe(process.env.STRIPE_SECRET_KEY);

// ============================
// Register
// ============================
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ success: false, message: "User already exists" });

    let cart = {};
    for (let i = 1; i <= 300; i++) cart[i] = 0;

    const newUser = new User({ name, email, password, cartData: cart });
    await newUser.save();
    res.status(201).json({ success: true, message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ============================
// Login
// ============================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "Register First Kindly!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ success: true, message: "User Login successfully!", token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ============================
// Payment Endpoint
// ============================
router.post("/payment", auth, async (req, res) => {
  try {
    const { fullName, address, phoneNumber, orderData, total } = req.body;
    if (!total || total <= 0) return res.status(400).json({ success: false, message: "Invalid total amount" });

    const userId = req.user.id;
    const user = await User.findById(userId).select("email");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Create PaymentIntent
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "usd",
      metadata: { userId, fullName },
      automatic_payment_methods: { enabled: true },
    });

    // Save order with status "Pending"
    await Order.findOneAndUpdate(
      { paymentIntentId: paymentIntent.id },
      {
        $set: {
          userId,
          fullName,
          email: user.email,
          address,
          phoneNumber,
          paymentMethod: "Card",
          paymentStatus: "Pending",
          orderData,
          total,
          paymentIntentId: paymentIntent.id,
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message });
  }
});

// ============================
// Stripe Webhook
// ============================

router.post("/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripeClient.webhooks.constructEvent(
      req.body, // raw body
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const intent = event.data.object;

    switch (event.type) {
      case "payment_intent.succeeded":
        await Order.findOneAndUpdate(
          { paymentIntentId: intent.id },
          { $set: { paymentStatus: "Paid" } }
        );
        console.log(`✅ Payment succeeded: ${intent.id}`);
        break;

      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await Order.findOneAndUpdate(
          { paymentIntentId: intent.id },
          { $set: { paymentStatus: "Failed" } }
        );
        console.log(`❌ Payment failed/canceled: ${intent.id}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    res.status(500).send("Server error");
  }
});

// ============================
// Protected route
// ============================
router.get("/protected", auth, (req, res) => {
  res.json({ success: true, message: "Welcome to the protected route!", user: req.user });
});

module.exports = router;
