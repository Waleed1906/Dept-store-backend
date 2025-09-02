// routes/chat.js
import express from "express";
const router = express.Router();
import Chat from "../models/Chat.js";
import Product from "../models/products.js";
import axios from "axios";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { GoogleGenerativeAI } from "@google/generative-ai";
import auth from "../middlewares/auth.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const BACKEND_URL = "https://dept-store-backend.vercel.app";

// LangChain + Gemini chain
const createLangChain = () => {
  const memory = new BufferMemory({ memoryKey: "chat_history", returnMessages: true });

  const chain = new ConversationChain({
    llm: {
      generate: async ({ input }) => {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: input }] }],
        });
        const text = await result.response.text();
        return { text };
      },
    },
    memory,
  });

  return chain;
};

// Tools AI can call
const tools = {
  addToCart: async ({ userId, productId, quantity }) => {
    const res = await axios.post(
      `${BACKEND_URL}/addtocart`,
      { itemId: productId, quantity },
      { headers: { Authorization: `Bearer ${userId}` } }
    );
    return `✅ Added ${quantity} ${res.data.productName} to your cart.`;
  },
  removeFromCart: async ({ userId, productId, removeCompletely }) => {
    const res = await axios.post(
      `${BACKEND_URL}/removetocart`,
      { itemId: productId, removeCompletely },
      { headers: { Authorization: `Bearer ${userId}` } }
    );
    return `🗑️ Removed ${res.data.productName} from your cart.`;
  },
  getCartItems: async ({ userId }) => {
    const res = await axios.post(
      `${BACKEND_URL}/getcart`,
      {},
      { headers: { Authorization: `Bearer ${userId}` } }
    );
    return res.data;
  },
};

// Helper: format products for AI prompt
const getProductsText = async () => {
  const products = await Product.find({});
  const categories = {};
  products.forEach(p => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(`${p.name} (Rs ${p.new_price})`);
  });
  return Object.keys(categories)
    .map(cat => `📌 ${cat.replace("_", " & ")}:\n- ${categories[cat].join("\n- ")}`)
    .join("\n\n");
};

// POST /api/chat
router.post("/", auth, async (req, res) => {
  try {
    const { userId} = req.user;
    const   {message } = req.body;

    // 1️⃣ Fetch/create chat
    let chat = await Chat.findOne({ userId });
    if (!chat) chat = new Chat({ userId, messages: [] });

    // 2️⃣ Save user message
    chat.messages.push({ sender: "user", text: message });
    await chat.save();

    // 3️⃣ Retrieve products for context
    const productsText = await getProductsText();

    // 4️⃣ Create LangChain
    const chain = createLangChain();

    // 5️⃣ Build prompt with function hints
    const prompt = `
You are a shopping assistant. Only answer shopping-related questions.

Available products:
${productsText}

Available functions you can call:
- addToCart({userId, productId, quantity})
- removeFromCart({userId, productId, removeCompletely})
- getCartItems({userId})

User query: ${message}
`;

    // 6️⃣ Get AI response
    let result = await chain.call({ input: prompt });
    let botResponse = result.text;

    // 7️⃣ Check if AI wants to call a function (simple regex example)
    const addMatch = botResponse.match(/add (\d+) (.+) to cart/i);
    if (addMatch) {
      const quantity = Number(addMatch[1]);
      const name = addMatch[2];
      const product = await Product.findOne({ name: new RegExp(name, "i") });
      if (product) {
        const toolResponse = await tools.addToCart({ userId, productId: product.id, quantity });
        botResponse += `\n${toolResponse}`;
      }
    }

    const removeMatch = botResponse.match(/remove (.+) from cart/i);
    if (removeMatch) {
      const name = removeMatch[1];
      const product = await Product.findOne({ name: new RegExp(name, "i") });
      if (product) {
        const toolResponse = await tools.removeFromCart({ userId, productId: product.id, removeCompletely: true });
        botResponse += `\n${toolResponse}`;
      }
    }

    // 8️⃣ Save bot response
    chat.messages.push({ sender: "bot", text: botResponse });
    await chat.save();

    res.json({ response: botResponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ response: "⚠️ Something went wrong. Please try again." });
  }
});

export default router;
