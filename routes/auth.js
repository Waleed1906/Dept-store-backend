// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const Stripe = require("stripe");

const User = require("../models/user");
const Order = require("../models/order");
const auth = require("../middlewares/auth");

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
    if (userExists)
      return res.status(400).json({ success: false, message: "User already exists" });

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
    if (!user)
      return res.status(400).json({ success: false, message: "Register First Kindly!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: "Invalid credentials" });

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
    if (!total || total <= 0)
      return res.status(400).json({ success: false, message: "Invalid total amount" });

    const userId = req.user.id;
    const user = await User.findById(userId).select("email");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "usd",
      metadata: {
        userId,
        fullName,
        address,
        phoneNumber,
        orderData: JSON.stringify(orderData),
      },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ success: true, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================
// Stripe Webhook
// ============================
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripeClient.webhooks.constructEvent(
      req.body,
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
        const { userId, fullName, address, phoneNumber, orderData } = intent.metadata;

        await Order.create({
          userId,
          fullName,
          email: (await User.findById(userId)).email,
          address,
          phoneNumber,
          paymentMethod: "Card",
          paymentStatus: "Paid",
          orderData: JSON.parse(orderData),
          total: intent.amount / 100,
          paymentIntentId: intent.id,
        });

        console.log(`✅ Payment succeeded: ${intent.id}`);

        const emptyCart = {};
        for (let i = 1; i <= 300; i++) emptyCart[i] = 0;
        await User.findByIdAndUpdate(userId, { cartData: emptyCart });
        break;

      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
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
// Order History
// ============================
router.get("/order-history", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });

    if (!orders || orders.length === 0)
      return res.status(404).json({ success: false, message: "No orders found" });

    res.json({ success: true, orders });
  } catch (err) {
    console.error("Error fetching order history:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ============================
// Protected route
// ============================
router.get("/protected", auth, (req, res) => {
  res.json({ success: true, message: "Welcome to the protected route!", user: req.user });
});

module.exports = router;