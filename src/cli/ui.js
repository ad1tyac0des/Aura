import * as p from "@clack/prompts";
import pc from "picocolors";

export function showIntro() {
    p.intro(pc.bgCyan(pc.black(" Aura MCP Chat CLI ")));
}

export function showOutro() {
    p.outro(pc.cyan("Goodbye!"));
}

export async function getUserInput() {
    const userInput = await p.text({
        message: pc.green("You:"),
        placeholder: "Type a message or 'help' for commands",
    });

    if (p.isCancel(userInput)) {
        showOutro();
        process.exit(0);
    }

    return userInput.trim();
}

export function printAIResponse(text, provider = "Cloud") {
    const providerTag = pc.gray(`[${provider}]`);
    console.log(`\n${pc.cyan("AI:")} ${providerTag} ${text}\n`);
}

export function printError(msg) {
    p.log.error(msg);
}

export function createSpinner() {
    return p.spinner();
}
