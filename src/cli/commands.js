import * as p from "@clack/prompts";
import pc from "picocolors";
import presets from "../config/presets.json" with { type: "json" };
import { showOutro } from "./ui.js";

// Returns a boolean: true if the input was a command (and processed), false otherwise
export async function processCommand(input, appState) {
    const cmd = input.toLowerCase();

    if (cmd === "exit" || cmd === "quit") {
        showOutro();
        process.exit(0);
    }

    if (cmd === "help" || cmd === "?") {
        console.log(`\n${pc.bgBlue(pc.white(" Available Commands "))}`);
        console.log(`${pc.green("help, ?")}      - Show this help menu`);
        console.log(`${pc.green("/sysprompt")}   - Set the system prompt / AI personality`);
        console.log(`${pc.green("exit, quit")}   - Exit the CLI\n`);
        return true;
    }

    if (cmd === "/sysprompt") {
        const options = presets.presets.map((preset) => ({
            value: preset.prompt,
            label: preset.name,
            hint: preset.prompt.substring(0, 40) + "..."
        }));

        options.push({ value: "custom", label: "Custom", hint: "Write your own system prompt" });

        const selected = await p.select({
            message: "Select a system prompt preset:",
            options: options
        });

        if (p.isCancel(selected)) {
            p.log.info("System prompt change cancelled.");
            return true;
        }

        let newPrompt = selected;
        if (selected === "custom") {
            const customPrompt = await p.text({
                message: "Enter your custom system prompt:"
            });
            if (p.isCancel(customPrompt) || !customPrompt.trim()) {
                p.log.info("System prompt change cancelled.");
                return true;
            }
            newPrompt = customPrompt.trim();
        }

        appState.systemInstruction = newPrompt;
        
        // Signal that the chat session needs to be recreated
        appState.requiresReinitialization = true;
        p.log.success("System prompt updated! The next message will use the new personality.");
        return true;
    }

    return false;
}
