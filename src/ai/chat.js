import { GoogleGenAI } from "@google/genai";
import { callTool } from "../mcp/client.js";

let ai = null;

function getAI() {
    if (!ai) {
        ai = new GoogleGenAI({});
    }
    return ai;
}

class OllamaChatSession {
    constructor(tools, systemInstruction, history = []) {
        this.tools = tools;
        this.history = history.length ? history : (systemInstruction ? [{role: "system", content: systemInstruction}] : []);
    }

    async getHistory() {
        return this.history;
    }

    async sendMessage({ message }) {
        if (typeof message === 'string') {
            this.history.push({ role: "user", content: message });
        } else if (Array.isArray(message)) {
            for (const part of message) {
                if (part.functionResponse) {
                    const resContent = part.functionResponse.response.result || part.functionResponse.response.error;
                    this.history.push({
                        role: "tool",
                        content: typeof resContent === 'object' ? JSON.stringify(resContent) : String(resContent),
                        name: part.functionResponse.name
                    });
                }
            }
        }

        const ollamaTools = this.tools.map(t => ({
            type: "function",
            function: { name: t.name, description: t.description, parameters: t.parameters }
        }));

        const ollamaUrl = process.env.OLLAMA_URL || "http://192.170.8.54:11434";
        const ollamaModel = process.env.OLLAMA_MODEL || "qwen3:8b";

        const response = await fetch(`${ollamaUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: ollamaModel,
                messages: this.history,
                tools: ollamaTools.length > 0 ? ollamaTools : undefined,
                stream: false
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        this.history.push(data.message);

        const result = { text: data.message.content || "", provider: "Local" };
        
        if (data.message.tool_calls && data.message.tool_calls.length > 0) {
            result.functionCalls = data.message.tool_calls.map(tc => ({
                name: tc.function.name,
                args: tc.function.arguments
            }));
        }

        return result;
    }
}

class HybridChatSession {
    constructor(tools, systemInstruction, history = []) {
        this.ollama = new OllamaChatSession(tools, systemInstruction, history);
        this.activeProvider = "Cloud";
        
        const config = {
            tools: [{ functionDeclarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
        };
        if (systemInstruction) {
            config.systemInstruction = systemInstruction;
        }

        const chatConfig = {
            model: "gemini-3-flash-preview",
            config: config
        };
        if (history && history.length > 0) {
            chatConfig.history = history;
        }
        
        this.gemini = getAI().chats.create(chatConfig);
    }

    async getHistory() {
        if (this.activeProvider === "Local") {
            return this.ollama.getHistory();
        }
        return await this.gemini.getHistory();
    }

    async sendMessage({ message }) {
        if (this.activeProvider === "Local") {
            return await this.ollama.sendMessage({ message });
        }

        try {
            const res = await this.gemini.sendMessage({ message });
            res.provider = "Cloud";
            
            // Keep ollama history synced in case we need to fallback later
            if (typeof message === 'string') {
                this.ollama.history.push({ role: "user", content: message });
            } else if (Array.isArray(message)) {
                for (const part of message) {
                    if (part.functionResponse) {
                        const resContent = part.functionResponse.response.result || part.functionResponse.response.error;
                        this.ollama.history.push({
                            role: "tool",
                            content: typeof resContent === 'object' ? JSON.stringify(resContent) : String(resContent),
                            name: part.functionResponse.name
                        });
                    }
                }
            }
            
            // Reconstruct assistant message for ollama history
            const assistantMsg = { role: "assistant", content: res.text || "" };
            if (res.functionCalls && res.functionCalls.length > 0) {
                assistantMsg.tool_calls = res.functionCalls.map(fn => ({
                    type: "function",
                    function: { name: fn.name, arguments: fn.args }
                }));
            }
            this.ollama.history.push(assistantMsg);
            
            return res;
        } catch (geminiError) {
            // Fallback to Ollama
            this.activeProvider = "Local";
            try {
                return await this.ollama.sendMessage({ message });
            } catch (ollamaError) {
                throw new Error(`Both Cloud and Local models failed.\n[Cloud Error]: ${geminiError.message}\n[Local Error]: ${ollamaError.message}`);
            }
        }
    }
}

export function createChatSession(tools, systemInstruction, existingHistory = []) {
    return new HybridChatSession(tools, systemInstruction, existingHistory);
}

export async function sendChatMessage(chat, tools, userInput, s) {
    s.start("AI is thinking...");

    try {
        let result = await chat.sendMessage({ message: userInput });

        while (result.functionCalls && result.functionCalls.length > 0) {
            s.message(`Running tool(s): ${result.functionCalls.map(f => f.name).join(", ")}... [${result.provider}]`);
            
            const functionResponsesParts = [];
            for (const fnCall of result.functionCalls) {
                try {
                    const toolResult = await callTool(tools, fnCall.name, fnCall.args);
                    functionResponsesParts.push({
                        functionResponse: {
                            name: fnCall.name,
                            response: { result: toolResult },
                        }
                    });
                } catch (error) {
                    functionResponsesParts.push({
                        functionResponse: {
                            name: fnCall.name,
                            response: { error: String(error) },
                        }
                    });
                }
            }
            
            s.message(`Sending tool results back to AI... [${result.provider}]`);
            result = await chat.sendMessage({ message: functionResponsesParts });
        }

        s.stop(`AI responded`);
        return { text: result.text, provider: result.provider };
    } catch (error) {
        s.stop("Error occurred");
        throw error;
    }
}
