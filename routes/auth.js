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

// ------------------- Create Stripe PaymentIntent -------------------
const createPaymentIntent = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.userId;

    const user = await user.findById(userId);
    if (!user) return res.json({ success: false, message: 'User not found' });
    if (!planId) return res.json({ success: false, message: 'Missing Plan Id' });

  

    // Check for existing pending transaction
    const existingTxn = await transactionModel.findOne({ userId, plan, status: 'pending' });
    if (existingTxn) {
      const pi = await stripe.paymentIntents.retrieve(existingTxn.paymentIntentId);
      return res.json({
        success: true,
        clientSecret: pi.client_secret,
        message: 'Existing pending PaymentIntent reused',
      });
    }

    // Create new Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      metadata: { userId, plan },
      automatic_payment_methods: { enabled: true },
    });

    // Save transaction in DB
    await transactionModel.findOneAndUpdate(
      { paymentIntentId: paymentIntent.id },
      {
        $set: {
          userId,
          plan,
          credits,
          amount,
          status: 'pending',
          date: Date.now(),
          paymentIntentId: paymentIntent.id,
        },
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      message: 'PaymentIntent created',
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

   


    


// ============================
// Protected route
// ============================
router.get('/protected', auth, (req, res) => {
  res.json({ success: true, message: 'Welcome to the protected route!', user: req.user });
});

module.exports = router;
