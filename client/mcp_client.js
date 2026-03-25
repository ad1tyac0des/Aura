import { GoogleGenAI } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { config } from "dotenv";

config();

const ai = new GoogleGenAI({});

const transport = new StdioClientTransport({
    command: "cmd",
    args: ["/c", "cd", "d:\\MyProjectsAndTools\\Aura\\servers\\python", "&&", "uv", "run", "python", "weather_server.py"],
});

const client = new Client({ name: "my-client", version: "1.0.0" });
await client.connect(transport);

let tools = []; // List of tools from MCP server and format them for use in the Google GenAI config
await client.listTools().then((response) => {
    // Format each tool from the MCP server according to the expected format for function declarations in the Google GenAI config
    response.tools.forEach((tool) => {
        tools.push({
            name: tool.name,
            description: tool.description,
            parameters: {
                type: tool.inputSchema.type,
                properties: tool.inputSchema.properties,
                required: tool.inputSchema.required,
            },
        });
    });
});

const aiResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "whats the weather in london",
    config: {
        tools: [
            {
                functionDeclarations: tools,
            },
        ],
    },
});

// Check for fn call in AI response and call each tool via MCP client
if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
    console.log("AI Response: ", aiResponse.functionCalls);

    aiResponse.functionCalls.forEach(async (fnCall) => {
        const result = await client.callTool({
            name: fnCall.name,
            arguments: fnCall.args,
        });

        console.log("Result from tool call: ", result);
    });
} else {
    console.log("No Function call required.");
    console.log("AI Response: ", aiResponse.text);
}