const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const axios = require('axios');
const router = express.Router();
const auth = require('../middlewares/auth');
const Order = require('../models/order');
const crypto = require('crypto');

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

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ success: true, message: 'User Login successfully!', token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================
// Payment route (Card Checkout)
// ============================
router.post('/payment', auth, async (req, res) => {
  try {
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

    // 🔑 2Checkout Hosted Checkout credentials
    const merchantCode = process.env.TWOCHECKOUT_MERCHANT_CODE;
    const buyLinkSecret = process.env.TWOCHECKOUT_BUY_LINK_SECRET_WORD;

    // 🔐 Build signature (MD5: merchant + secret + total + currency)
    const stringToHash = `${merchantCode}${buyLinkSecret}${total.toFixed(2)}USD`;
    const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

    // ✅ Build hosted checkout URL
    const checkoutUrl = `https://secure.2checkout.com/checkout/buy?merchant=${merchantCode}&currency=USD&amount=${total.toFixed(
      2
    )}&signature=${signature}&return-url=https://ecom-frontend-navy.vercel.app/payment-success&order-ext-ref=${newOrder._id}`;

    return res.json({ success: true, checkoutUrl });
  } catch (error) {
    console.error('2Checkout Payment error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during payment',
      error: error.response?.data || error.message,
    });
  }
});


// ============================
// Protected route
// ============================
router.get('/protected', auth, (req, res) => {
  res.json({ success: true, message: 'Welcome to the protected route!', user: req.user });
});

module.exports = router;
