const express = require("express");
const router = express.Router();
const Product = require("../models/products");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Order = require("../models/order");
const auth = require("../middlewares/auth");
const dotenv = require("dotenv");
// POST /chatbot
router.post("/", async (req, res) => {
  try {
    const { userId, message } = req.body;

    // Send user query to Gemini with a restricted system prompt
    const botResponse = await geminiService.runQuery(message, async (action, params) => {
      // Handle actions Gemini decides (cart, product, order, etc.)
      switch (action) {
        case "getProductPrice":
          const product = await Product.findOne({ name: params.name });
          return product ? `The price of ${params.name} is $${product.new_price}` : `Product not found.`;

        case "addToCart":
          let cart = await Cart.findOne({ userId });
          if (!cart) cart = new Cart({ userId, items: [], totalPrice: 0 });

          cart.items.push({ productId: params.productId, quantity: params.quantity });
          await cart.save();
          return `${params.quantity} ${params.name} added to your cart.`;

        case "removeFromCart":
          let cart2 = await Cart.findOne({ userId });
          if (cart2) {
            cart2.items = cart2.items.filter(i => i.productId !== params.productId);
            await cart2.save();
          }
          return `${params.name} removed from your cart.`;

        case "getCart":
          const userCart = await Cart.findOne({ userId }).populate("items.productId");
          if (!userCart || userCart.items.length === 0) return "Your cart is empty.";
          return `Your cart has ${userCart.items.map(i => `${i.quantity} x ${i.productId.name}`).join(", ")}.`;

        case "getOrders":
          const orders = await Order.find({ userId });
          if (!orders.length) return "No previous orders found.";
          return `Your last order: ${JSON.stringify(orders[orders.length - 1])}`;

        default:
          return "I can only help with cart, products, and orders.";
      }
    });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function runQuery(message, actionHandler) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const systemPrompt = `
  You are the chatbot for LA Organic Store.
  You ONLY answer using the store database and tools provided.
  You can do these actions: getProductPrice, addToCart, removeFromCart, getCart, getOrders.
  Never make up products or prices.
  `;

  // Send query
  const result = await model.generateContent([systemPrompt, message]);
  const text = result.response.text();

  // For now, assume text = action + params (later we refine with structured output)
  // Example: "addToCart: { productId: '123', name: 'Mango', quantity: 2 }"
  try {
    const { action, params } = JSON.parse(text);
    return await actionHandler(action, params);
  } catch {
    return text; // fallback plain text
  }
}

module.exports = { runQuery };

    res.json({ reply: botResponse });
  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Something went wrong. Try again later." });
  }
});

module.exports = router;
