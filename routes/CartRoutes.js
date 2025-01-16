const express = require("express");
const Cart = require("../models/cart");
const router = express.Router();

// Add to Cart
router.post("/add-to-cart", async (req, res) => {
  try {
    const { userId, productId, quantity, price } = req.body;

    // Validate the input
    if (!userId || !productId || !quantity || !price) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Find the user's cart
    let cart = await Cart.findOne({ userId });

    // If cart doesn't exist, create a new one
    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity }],
        totalPrice: quantity * price,
      });
    } else {
      // If product already in cart, update quantity; otherwise, add new item
      const existingItem = cart.items.find(
        (item) => item.productId === productId
      );
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ productId, quantity });
      }
      // Recalculate total price
      cart.totalPrice += quantity * price;
    }

    // Save the cart
    await cart.save();
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
