const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const axios = require('axios');
const router = express.Router();
const auth = require('../middlewares/auth');
const Order = require('../models/order');
const dotenv = require("dotenv");

// ============================
// Register a new user
// ============================
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    let cart = {};
    for (let i = 1; i <= 300; i++) {
      cart[i] = 0;
    }

    const newUser = new User({ name, email, password, cartData: cart });
    await newUser.save();

    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================
// Login user
// ============================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Register First Kindly!' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ success: true, message: 'User Login successfully!', token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================
// Payment Method (Safepay)
// ============================
router.post('/payment', auth, async (req, res) => {
  try {
    const SAFEPAY_SECRET_KEY = process.env.SAFE_PAY_SECRET_KEY; // sk_...
    const SAFEPAY_PUBLIC_KEY = process.env.SAFE_PAY_PUBLIC_KEY; // pk_...

    const CALLBACK_URL = "https://ecom-frontend-navy.vercel.app/";
    const { fullName, address, phoneNumber, orderData, total } = req.body;
    const userId = req.user.id || req.user.userId;

    const user = await User.findById(userId).select('email');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Save pending order
    const newOrder = new Order({
      userId,
      fullName,
      email: user.email,
      address,
      phoneNumber,
      paymentMethod: 'Card',
      paymentStatus: 'Pending',
      orderData,
      total,
    });
    await newOrder.save();

    // Create Safepay payment session
    const safepayPayload = {
      amount: total,
      currency: "PKR",
      orderId: newOrder._id.toString(),
      customer: {
        name: fullName,
        phone: phoneNumber,
        email: user.email,
        address,
      },
      paymentMethod: "Card",
      callbackUrl: CALLBACK_URL,
      client: SAFEPAY_PUBLIC_KEY,
      environment: "sandbox"
    };

    console.log("Safepay Payload:", safepayPayload);

    let safepayResponse;
    try {
      safepayResponse = await axios.post(
        "https://sandbox.api.getsafepay.com/order/v1/init",
        safepayPayload,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SAFEPAY_SECRET_KEY}`,
          },
        }
      );
    } catch (err) {
      console.error("Safepay API Error:", err.response?.data || err.message);
      return res.status(500).json({ success: false, message: "Failed to create Safepay session" });
    }

    console.log("Safepay Response:", safepayResponse.data);

    // ✅ Return sessionToken (for Safepay.checkout in frontend)
    if (safepayResponse?.data?.data?.token) {
      const token = safepayResponse.data.data.token;
      res.json({ success: true, sessionToken: token });
    } else {
      res.status(500).json({ success: false, message: "No payment token returned by Safepay" });
    }

  } catch (error) {
    console.error("Error creating Safepay payment:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Failed to initiate payment" });
  }
});


// ============================
// Protected route
// ============================
router.get('/protected', auth, (req, res) => {
  res.json({ success: true, message: 'Welcome to the protected route!', user: req.user });
});

module.exports = router;
