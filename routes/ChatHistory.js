const express = require("express");
const auth = require("../middlewares/auth");
const Chat = require("../models/Chat");
const User = require("../models/user");
const Product = require("../models/products");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

// Utility to normalize product names & queries
const normalize = (str) => str.toLowerCase().replace(/\s+/g, "").trim();

// POST /chat/message
router.post("/message", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || typeof message !== "string")
      return res.status(400).json({ success: false, message: "Message is required" });

    // Fetch all products
    const allProducts = await Product.find({});

    // Case-insensitive finder
    const findProduct = (query) => {
      const normQuery = normalize(query);
      return allProducts.find((p) => normalize(p.name).includes(normQuery));
    };

    const lowerMessage = message.toLowerCase();
    let botReply = "";

    // ----- Handle Add to Cart -----
    if (lowerMessage.includes("add") || lowerMessage.includes("buy")) {
      const productName = message.replace(/add|buy/gi, "").trim();
      const product = findProduct(productName);
      if (product) {
        await axios.post(
          `${process.env.BACKEND_URL}/addtocart`,
          { itemId: product.id },
          { headers: { Authorization: req.headers.authorization } }
        );
        botReply = `✅ Added ${product.name} to your cart. 🛍️`;
      } else {
        botReply = "⚠️ Sorry, I couldn’t find that product in our store.";
      }
    }

    // ----- Handle Remove from Cart -----
    else if (lowerMessage.includes("remove") || lowerMessage.includes("delete")) {
      const productName = message.replace(/remove|delete/gi, "").trim();
      const product = findProduct(productName);
      if (product) {
        await axios.post(
          `${process.env.BACKEND_URL}/removetocart`,
          { itemId: product.id },
          { headers: { Authorization: req.headers.authorization } }
        );
        botReply = `🗑️ Removed ${product.name} from your cart.`;
      } else {
        botReply = "⚠️ I couldn’t find that product in your cart.";
      }
    }

    // ----- Show Cart -----
    else if (lowerMessage.includes("show cart") || lowerMessage.includes("view cart")) {
      const cartRes = await axios.post(
        `${process.env.BACKEND_URL}/getcart`,
        {},
        { headers: { Authorization: req.headers.authorization } }
      );
      const cartData = cartRes.data;
      const items = Object.keys(cartData)
        .filter((id) => cartData[id] > 0)
        .map((id) => {
          const product = allProducts.find((p) => p.id === Number(id));
          return product ? `${product.name} (x${cartData[id]})` : null;
        })
        .filter(Boolean);
      botReply = items.length
        ? `🛒 Your cart contains:\n- ${items.join("\n- ")}`
        : "🛒 Your cart is empty.";
    }

    // ----- Other Cases (Price, Total Amount, Show Products, Gemini AI) -----
    else if (lowerMessage.includes("price") || lowerMessage.includes("cost")) {
      const productName = message.replace(/price|cost/gi, "").trim();
      const product = findProduct(productName);
      botReply = product
        ? `💲 The price of ${product.name} is Rs ${product.new_price}.`
        : "⚠️ Hmm, I don’t see that item in our catalog.";
    } else if (lowerMessage.includes("total amount") || lowerMessage.includes("total price")) {
      const cartRes = await axios.post(
        `${process.env.BACKEND_URL}/getcart`,
        {},
        { headers: { Authorization: req.headers.authorization } }
      );
      const cartData = cartRes.data;
      const totalAmount = Object.entries(cartData).reduce((acc, [id, qty]) => {
        const product = allProducts.find((p) => p.id === Number(id));
        return product ? acc + product.new_price * qty : acc;
      }, 0);
      botReply = `💰 The total amount of your cart is Rs ${totalAmount}.`;
    } else if (lowerMessage.includes("all products") || lowerMessage.includes("list products")) {
      const categories = {};
      allProducts.forEach((p) => {
        if (!categories[p.category]) categories[p.category] = [];
        categories[p.category].push(`${p.name} (Rs ${p.new_price})`);
      });
      botReply = Object.keys(categories)
        .map(
          (cat) => `📌 ${cat.replace("_", " & ")}:\n- ${categories[cat].join("\n- ")}`
        )
        .join("\n\n");
    } else {
      // ----- STREAMING Gemini AI -----
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Streaming headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const stream = await model.generateContentStream({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `
You are a shopping assistant. ONLY talk about the store’s products and shopping-related queries.
If the user asks something unrelated, politely say:
"Sorry, I can only help with shopping questions in our store."

User query: ${message}
Available products:\n${allProducts.map((p) => `${p.name} (Rs ${p.new_price})`).join("\n")}
                  `,
                },
              ],
            },
          ],
        });

        let botReply = "";

        for await (const chunk of stream.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            botReply += chunkText;
            res.write(`data: ${chunkText}\n\n`); // send partial reply
          }
        }

        res.write("event: end\ndata: [DONE]\n\n");
        res.end();

        // Save chat history
        const userMessageObj = { sender: "user", text: message };
        const botMessageObj = { sender: "bot", text: botReply };

        let chatDoc = await Chat.findOne({ userId });
        if (chatDoc) {
          chatDoc.messages.push(userMessageObj, botMessageObj);
        } else {
          chatDoc = new Chat({ userId, messages: [userMessageObj, botMessageObj] });
        }
        await chatDoc.save();
        return; // avoid res.json since we already streamed
      } catch (error) {
        console.error("Gemini API Error:", error);
        res.write("data: ⚠️ Oops! Something went wrong. Please try again.\n\n");
        res.write("event: end\ndata: [DONE]\n\n");
        res.end();
        return;
      }
    }

    // ----- Save Chat History (non-stream cases) -----
    const userMessageObj = { sender: "user", text: message };
    const botMessageObj = { sender: "bot", text: botReply };

    let chatDoc = await Chat.findOne({ userId });
    if (chatDoc) {
      chatDoc.messages.push(userMessageObj, botMessageObj);
    } else {
      chatDoc = new Chat({ userId, messages: [userMessageObj, botMessageObj] });
    }
    await chatDoc.save();

    res.json({ success: true, reply: botReply });
  } catch (error) {
    console.error("Error handling chat message:", error);
    res.status(500).json({ success: false, message: "Failed to process message" });
  }
});

module.exports = router;
