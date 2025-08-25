const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const axios = require('axios');
const router = express.Router();
const auth = require('../middlewares/auth');
const Order = require('../models/order');

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

    // Build 2Checkout payment URL
    const merchantCode = process.env.TWOCHECKOUT_MERCHANT_CODE;
    const secretWord = process.env.TWOCHECKOUT_SECRET_WORD; // Instant Notification Service secret
    const returnUrl = 'https://ecom-frontend-navy.vercel.app/';

    const params = {
      sid: merchantCode,
      mode: '2CO',
      li_0_name: 'Order ' + newOrder._id,
      li_0_price: total.toFixed(2),
      currency_code: 'PKR',
      x_receipt_link_url: returnUrl,
      card_holder_name: fullName,
      street_address: address,
      email: user.email,
      phone: phoneNumber,
      merchant_order_id: newOrder._id.toString(),
    };

    // Optional: sign the URL if required by 2Checkout
    // const signature = crypto.createHash('md5').update(secretWord + merchantCode + newOrder._id + total.toFixed(2)).digest('hex');

    const queryString = new URLSearchParams(params).toString();
    const checkoutUrl = `https://www.2checkout.com/checkout/purchase?${queryString}`;

    res.json({ success: true, checkoutUrl });

  } catch (err) {
    console.error('2Checkout Payment error:', err.message);
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
