import { GoogleGenAI } from "@google/genai";
import { callTool } from "../mcp/client.js";

let ai = null;

function getAI() {
    if (!ai) {
        ai = new GoogleGenAI({});
    }
    return ai;
}

export function createChatSession(tools, systemInstruction, existingHistory = []) {
    const config = {
        tools: [{ functionDeclarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
    };

    if (systemInstruction) {
        config.systemInstruction = systemInstruction;
    }

    // @google/genai lets us pass history, but we need to format it properly or just rely on passing it.
    // If the API supports passing existing history during init:
    const chatConfig = {
        model: "gemini-3-flash-preview",
        config: config
    };
    
    if (existingHistory && existingHistory.length > 0) {
        chatConfig.history = existingHistory;
    }
    
    return getAI().chats.create(chatConfig);
}

export async function sendChatMessage(chat, tools, userInput, s) {
    s.start("AI is thinking...");

    try {
        let result = await chat.sendMessage({ message: userInput });

        while (result.functionCalls && result.functionCalls.length > 0) {
            s.message(`Running tool(s): ${result.functionCalls.map(f => f.name).join(", ")}...`);
            
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
            
            s.message("Sending tool results back to AI...");
            result = await chat.sendMessage({ message: functionResponsesParts });
        }

        s.stop("AI responded");
        return result.text;
    } catch (error) {
        s.stop("Error occurred");
        throw error;
    }
}
