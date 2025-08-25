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

    if (!Array.isArray(orderData) || orderData.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
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

    // Recalculate total on server for safety
    const computedTotal = orderData.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);

    // 🔑 2Checkout Hosted Checkout credentials
    const merchantCode = process.env.TWOCHECKOUT_MERCHANT_CODE;
    const buyLinkSecret = process.env.TWOCHECKOUT_BUY_LINK_SECRET_WORD;
    const currency = 'USD'; // change if you actually charge in a different currency

    // 🔐 Signature (dynamic pricing)
    const stringToHash = `${buyLinkSecret}${merchantCode}${computedTotal.toFixed(2)}${currency}`;
    const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

    // 🧾 Build Hosted Checkout URL with line items
    const params = new URLSearchParams();
    params.set('merchant', merchantCode);
    params.set('currency', currency);

    // Add each cart item: li_0_name, li_0_price, li_0_quantity, li_0_type, li_0_product_id
    orderData.forEach((item, idx) => {
      params.set(`li_${idx}_type`, 'product');
      params.set(`li_${idx}_name`, String(item.name));
      params.set(`li_${idx}_price`, Number(item.price).toFixed(2));
      params.set(`li_${idx}_quantity`, String(item.quantity));
      params.set(`li_${idx}_product_id`, String(item.productId || item.code || idx + 1));
    });

    // Required when using dynamic pricing override
    params.set('signature', signature);

    // Optional but useful
    params.set('order-ext-ref', String(newOrder._id));
    params.set('return-url', 'https://ecom-frontend-navy.vercel.app/payment-success');

    const checkoutUrl = `https://secure.2checkout.com/checkout/buy?${params.toString()}`;

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
