// routes/chat.js
const express = require("express");
const auth = require("../middlewares/auth");
const Chat = require("../models/Chat");

const router = express.Router();

// ✅ Save chat history
router.post("/save", auth, async (req, res) => {
  try {
    const userId = req.user.id; // coming from auth middleware
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: "Messages are required" });
    }

    // Create or update chat history
    let chat = await Chat.findOne({ userId });
    if (chat) {
      chat.messages.push(...messages);
      await chat.save();
    } else {
      chat = await Chat.create({ userId, messages });
    }

    res.json({ success: true, chat });
  } catch (err) {
    console.error("Error saving chat history:", err);
    res.status(500).json({ success: false, error: "Failed to save chat history" });
  }
});

// ✅ Get chat history
router.get("/history", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const chat = await Chat.findOne({ userId });
    res.json({ success: true, chat: chat || { messages: [] } });
  } catch (err) {
    console.error("Error fetching chat history:", err);
    res.status(500).json({ success: false, error: "Failed to fetch chat history" });
  }
});

module.exports = router;
