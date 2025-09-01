const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true, // ensure no duplicates
    },
    name: {
      type: String,
      required: true,
      trim: true, // removes spaces around names
    },
    image: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      lowercase: true, // normalize categories (e.g., "Grocery" -> "grocery")
    },
    new_price: {
      type: Number,
      required: true,
      min: 0, // no negative prices
    },
    old_price: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
