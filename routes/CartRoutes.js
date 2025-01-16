const express = require("express");
const Cart = require("../models/cart");
const User = require("../models/user");
const auth = require("../middlewares/auth");
const router = express.Router();

// Add to Cart
router.post("/add-to-cart", async (req, res) => {
  try {
    const { userId, productId, quantity, price } = req.body;

    if (!userId || !productId || !quantity || !price) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const cart = user.cart || { items: [], totalPrice: 0 };

    const existingItem = cart.items.find(
      (item) => item.productId === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity, price });
    }

    cart.totalPrice += quantity * price;

    user.cart = cart;
    await user.save();

    res.status(200).json({ message: "Item added to cart", cart: user.cart });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});
// get cart
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user || !user.cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    res.status(200).json(user.cart);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});
// remove item from cart
router.delete("/remove-item", async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res
        .status(400)
        .json({ message: "User ID and Product ID are required" });
    }

    const user = await User.findById(userId);

    if (!user || !user.cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const cart = user.cart;
    const itemIndex = cart.items.findIndex(
      (item) => item.productId === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Product not found in the cart" });
    }

    const removedItem = cart.items[itemIndex];
    cart.totalPrice -= removedItem.quantity * removedItem.price;

    cart.items.splice(itemIndex, 1);
    user.cart = cart;

    await user.save();

    res.status(200).json({ message: "Item removed from cart", cart });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
