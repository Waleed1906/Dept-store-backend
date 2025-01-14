const express = require("express");
const Cart = require("../routes/CartRoutes");
const router = express.Router();

// Add to Cart
router.post("/add-to-cart", async (req, res) => {
  try {
    const { userId, productId, quantity, price } = req.body;

    if (!userId || !productId || !quantity || !price) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity }],
        totalPrice: quantity * price,
      });
    } else {
      const existingItem = cart.items.find(
        (item) => item.productId === productId
      );
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ productId, quantity });
      }
      cart.totalPrice += quantity * price;
    }

    await cart.save();
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Fetch Cart Items
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
