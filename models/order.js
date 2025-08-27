const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true },       
  userId: { type: String, required: true },
  fullName: { type: String, required: true, trim: true },
  phoneNumber: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  paymentMethod: { type: String, required: true, enum: ['Cash on Delivery', 'Card'] },
  paymentStatus: { type: String, required: true, enum: ['Pending', 'Paid', 'Failed', 'Canceled'], default: 'Pending' },
  orderData: { type: Object, required: true },
  total: { type: Number, required: true },
  paymentIntentId: { type: String, unique: true, default: null },
  date: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
