import { GoogleGenAI } from "@google/genai";
import { initClients, getAllTools, callTool } from "./client/mcp_client.js";
import { config } from "dotenv";

config();

const ai = new GoogleGenAI({});

// 1. Init all MCP servers
const clients = await initClients();

// 2. Collect all tools from all servers
const tools = await getAllTools(clients);

// 3. Send to LLM
const aiResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "What's the weather in tokyo?",
    config: {
        tools: [{ functionDeclarations: tools }],
    },
});

// 4. Handle tool calls
if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
    for (const fnCall of aiResponse.functionCalls) {
        const result = await callTool(tools, fnCall.name, fnCall.args);
        console.log(`Result from ${fnCall.name}:`, result);
    }
} else {
    console.log("AI Response: ", aiResponse.text);
}
