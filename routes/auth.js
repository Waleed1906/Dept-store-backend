const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const axios = require('axios');
const router = express.Router();
const auth = require('../middlewares/auth');
const Order = require('../models/order');
const crypto = require('crypto');
const TwoCheckout = require('2checkout-node');
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



//Payment Gateway

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

    // Initialize 2Checkout API
    const tco = new TwoCheckout({
      sellerId: process.env.TWOCHECKOUT_MERCHANT_CODE,
      privateKey: process.env.TWOCHECKOUT_SECRET_KEY,
      sandbox: false, // false for production
    });

    // Prepare line items
    const lineItems = orderData.map((item) => ({
      name: item.name,
      price: item.price.toFixed(2),
      quantity: item.quantity,
      type: 'product',
      product_id: item.productId || item.code || undefined,
    }));

    // Create hosted checkout session
    const sessionParams = {
      currency: 'PKR',
      external_reference: String(newOrder._id),
      billing_details: {
        name: fullName,
        email: user.email,
        phone: phoneNumber,
        address: {
          line1: address,
        },
      },
      line_items: lineItems,
      return_url: 'https://ecom-frontend-navy.vercel.app/cart',
    };

    const session = await tco.hostedCheckout.create(sessionParams);

    res.json({ success: true, checkoutUrl: session.url });
  } catch (err) {
    console.error('2Checkout Payment error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during payment',
      error: err.message,
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
