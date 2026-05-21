import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import config from "../../config/servers_config.json" with { type: "json" };

// Init servers using client
export async function initClients() {
    const clients = {};

    for (const [name, cfg] of Object.entries(config.mcpServers)) {
        const transport = new StdioClientTransport({
            command: cfg.command,
            args: cfg.args,
        });

        const client = new Client({ name: `${name}-client`, version: "1.0.0" });
        await client.connect(transport);

        clients[name] = client;
    }

    return clients;
}

// Get all tools from clients and format them acc to gemini config.
export async function getAllTools(clients) {
    const tools = [];

    for (const client of Object.values(clients)) {
        const response = await client.listTools();
        response.tools.forEach((tool) => {
            tools.push({
                _client: client, // store which client owns this tool
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: tool.inputSchema.type,
                    properties: tool.inputSchema.properties,
                    required: tool.inputSchema.required,
                },
            });
        });
    }

    return tools;
}

// Call specific tool
export async function callTool(tools, name, args) {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool ${name} not found`);

    return await tool._client.callTool({
        name: name,
        arguments: args,
    });
}
