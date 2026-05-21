import { GoogleGenAI } from "@google/genai";
import { initClients, getAllTools, callTool } from "./client/mcp_client.js";
import { config } from "dotenv";
import * as p from "@clack/prompts";
import pc from "picocolors";

config();

const ai = new GoogleGenAI({});

async function main() {
    p.intro(pc.bgCyan(pc.black(" AGENT AURA ")));

    const s = p.spinner();
    s.start("Initializing MCP servers...");
    
    const clients = await initClients();
    const tools = await getAllTools(clients);
    
    s.stop("MCP servers initialized");

    const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
            tools: [{ functionDeclarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
        },
    });

    while (true) {
        const userInput = await p.text({
            message: pc.green("You:"),
            placeholder: "Type a message or 'exit' to quit",
        });

        if (p.isCancel(userInput) || userInput.trim().toLowerCase() === "exit") {
            p.outro(pc.cyan("Goodbye!"));
            process.exit(0);
        }

        if (!userInput.trim()) continue;

        s.start("AURA is thinking...");

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
                
                s.message("Processing tool results...");
                result = await chat.sendMessage({ message: functionResponsesParts });
            }

            s.stop("Response received");
            console.log(`\n${pc.cyan("AURA:")} ${result.text}\n`);
            
        } catch (error) {
            s.stop("Error occurred");
            p.log.error(error.message);
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
