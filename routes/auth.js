const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Order = require('../models/order');
const axios = require('axios');
const router = express.Router();
const auth = require('../middlewares/auth');
const dotenv = require("dotenv");
dotenv.config();

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
// Payment Endpoint (AbhiPay)
// ============================
router.post('/payment', auth, async (req, res) => {
  try {
    const { fullName, address, phoneNumber, orderData, total } = req.body;
    const userId = req.user.id || req.user.userId;

    // Fetch user email
    const user = await User.findById(userId).select('email');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Save order with Pending status
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

    // ============================
    // Create AbhiPay order
    // ============================
    const abhiPayResponse = await axios.post(
      'https://sandbox.abhipay.com.pk/api/v2/createOrder',
      {
        amount: total,
        currency: 'PKR',
        description: `Order #${newOrder._id}`,
        customer_name: fullName,
        customer_email: user.email,
        customer_phone: phoneNumber,
        success_url: `${process.env.FRONTEND_URL}/payment-success/${newOrder._id}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-cancel/${newOrder._id}`,
        webhook_url: `${process.env.BACKEND_URL}/api/auth/abhipay-webhook`
      },
      {
        headers: {
          Authorization: process.env.ABHI_PAY_SECRET_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const { paymentUrl, orderId } = abhiPayResponse.data;

    // Update order with AbhiPay orderId
    newOrder.abhipayOrderId = orderId;
    await newOrder.save();

    res.json({ success: true, paymentUrl });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// ============================
// Protected route
// ============================
router.get('/protected', auth, (req, res) => {
  res.json({ success: true, message: 'Welcome to the protected route!', user: req.user });
});

module.exports = router;
