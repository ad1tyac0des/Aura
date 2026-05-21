import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";

const execAsync = promisify(exec);

const server = new McpServer({
    name: "pc-control-server",
    version: "1.0.0",
});

// Tool 1: execute_command
server.tool(
    "execute_command",
    "Run a shell command on the host system.",
    { 
        command: z.string().describe("The shell command to execute"),
        user_confirmed: z.boolean().optional().describe("Set to true ONLY AFTER explicitly asking the user for permission to run a dangerous command (like rm, delete).")
    },
    async ({ command, user_confirmed }) => {
        try {
            // Check for dangerous commands (remove/delete operations)
            const dangerousPattern = /\b(rm|rmdir|del|erase|shred|mkfs|format|dd)\b/i;
            if (dangerousPattern.test(command) && !user_confirmed) {
                return {
                    content: [{ 
                        type: "text", 
                        text: `Error: The command '${command}' is considered dangerous. You MUST ask the user for explicit permission before executing it. Once the user approves, re-run this tool with user_confirmed set to true.` 
                    }],
                    isError: true,
                };
            }

            const { stdout, stderr } = await execAsync(command);
            let result = "";
            if (stdout) result += `STDOUT:\n${stdout}\n`;
            if (stderr) result += `STDERR:\n${stderr}\n`;
            if (!result) result = "Command executed successfully with no output.";
            
            return {
                content: [{ type: "text", text: result }],
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error executing command: ${error.message}` }],
                isError: true,
            };
        }
    }
);

// Tool 2: read_file
server.tool(
    "read_file",
    "Read the contents of a file on the local filesystem.",
    { path: z.string().describe("Absolute or relative path to the file") },
    async ({ path }) => {
        try {
            const content = await fs.readFile(path, "utf-8");
            return {
                content: [{ type: "text", text: content }],
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error reading file: ${error.message}` }],
                isError: true,
            };
        }
    }
);

// Tool 3: write_file
server.tool(
    "write_file",
    "Write text content to a local file.",
    { 
        path: z.string().describe("Absolute or relative path to the file"),
        content: z.string().describe("Content to write to the file")
    },
    async ({ path, content }) => {
        try {
            await fs.writeFile(path, content, "utf-8");
            return {
                content: [{ type: "text", text: `Successfully wrote to file: ${path}` }],
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error writing file: ${error.message}` }],
                isError: true,
            };
        }
    }
);

// Tool 4: list_directory
server.tool(
    "list_directory",
    "List the files and folders inside a given directory.",
    { path: z.string().describe("Absolute or relative path to the directory") },
    async ({ path }) => {
        try {
            const entries = await fs.readdir(path, { withFileTypes: true });
            const list = entries.map(entry => {
                const type = entry.isDirectory() ? "[DIR]" : "[FILE]";
                return `${type} ${entry.name}`;
            }).join("\n");
            
            return {
                content: [{ type: "text", text: list || "(Empty directory)" }],
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error listing directory: ${error.message}` }],
                isError: true,
            };
        }
    }
);

// Tool 5: get_system_stats
server.tool(
    "get_system_stats",
    "Retrieve system statistics such as CPU usage, memory usage, and uptime.",
    {},
    async () => {
        try {
            const freeMem = (os.freemem() / (1024 ** 3)).toFixed(2);
            const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(2);
            const usedMem = (os.totalmem() - os.freemem()) / (1024 ** 3);
            const memUsagePercent = ((usedMem / (os.totalmem() / (1024 ** 3))) * 100).toFixed(2);
            
            const uptimeHours = (os.uptime() / 3600).toFixed(2);
            const cpus = os.cpus();
            const cpuModel = cpus.length > 0 ? cpus[0].model : "Unknown";
            const cpuCores = cpus.length;
            const loadAvg = os.loadavg().map(v => v.toFixed(2)).join(", ");

            const stats = `System Statistics:
- Platform: ${os.platform()} (${os.release()})
- Architecture: ${os.arch()}
- Uptime: ${uptimeHours} hours
- CPU: ${cpuModel} (${cpuCores} cores)
- Load Average (1, 5, 15 min): ${loadAvg}
- Memory: ${usedMem.toFixed(2)} GB / ${totalMem} GB (${memUsagePercent}% used, ${freeMem} GB free)`.trim();

            return {
                content: [{ type: "text", text: stats }],
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error getting system stats: ${error.message}` }],
                isError: true,
            };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);
