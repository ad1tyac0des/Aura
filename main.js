import { config } from "dotenv";
import { initClients, getAllTools } from "./src/mcp/client.js";
import { showIntro, getUserInput, printAIResponse, printError, createSpinner } from "./src/cli/ui.js";
import { processCommand } from "./src/cli/commands.js";
import { createChatSession, sendChatMessage } from "./src/ai/chat.js";
import os from "os";

config();

const appState = {
    systemInstruction: `You are Aura, a powerful AI assistant. 
System Context:
- Operating System: ${os.type()} ${os.release()} (${os.platform()} ${os.arch()})
- Current Local Time: ${new Date().toString()}`,
    requiresReinitialization: true,
    chat: null
};

async function main() {
    showIntro();

    const s = createSpinner();
    s.start("Initializing MCP servers...");
    
    const clients = await initClients();
    const tools = await getAllTools(clients);
    
    s.stop("MCP servers initialized. Type 'help' for available commands.");

    while (true) {
        if (appState.requiresReinitialization) {
            let history = undefined;
            if (appState.chat) {
                try {
                    // Try to retrieve existing history if supported
                    history = await appState.chat.getHistory();
                } catch (e) {
                    // Fallback to empty history if not available
                    history = undefined;
                }
            }
            appState.chat = createChatSession(tools, appState.systemInstruction, history);
            appState.requiresReinitialization = false;
        }

        const userInput = await getUserInput();

        if (!userInput) continue;

        const isCommand = await processCommand(userInput, appState);
        if (isCommand) continue;

        try {
            const response = await sendChatMessage(appState.chat, tools, userInput, s);
            printAIResponse(response.text, response.provider);
        } catch (error) {
            printError(error.message);
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
