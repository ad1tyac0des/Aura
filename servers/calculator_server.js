import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
    name: "calculator-server",
    version: "1.0.0",
});

server.tool(
    "calculate",
    "Perform basic arithmetic operations (add, subtract, multiply, divide).",
    {
        operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("The arithmetic operation to perform"),
        a: z.number().describe("The first number"),
        b: z.number().describe("The second number")
    },
    async ({ operation, a, b }) => {
        let result;
        switch (operation) {
            case "add":
                result = a + b;
                break;
            case "subtract":
                result = a - b;
                break;
            case "multiply":
                result = a * b;
                break;
            case "divide":
                if (b === 0) {
                    return {
                        content: [{ type: "text", text: "Error: Division by zero is not allowed." }],
                        isError: true,
                    };
                }
                result = a / b;
                break;
            default:
                return {
                    content: [{ type: "text", text: `Error: Unknown operation ${operation}` }],
                    isError: true,
                };
        }

        return {
            content: [{ type: "text", text: `Result: ${result}` }],
        };
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);
