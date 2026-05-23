/**
 * MCP connection hub.
 *
 * Reads `agent/.mcp.json`, spawns each MCP server as a stdio child process,
 * and exposes their tools to the agent loop in the Anthropic tool format.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** A tool definition in the shape the Anthropic Messages API expects. */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
}

interface ServerConfig {
  command: string;
  args: string[];
}

export class McpHub {
  private readonly clients = new Map<string, Client>();
  private readonly toolToServer = new Map<string, string>();
  private tools: AnthropicTool[] = [];

  /** Spawns and connects to every server listed in the `.mcp.json` file. */
  async connect(configPath: string): Promise<void> {
    const cwd = dirname(configPath);
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      mcpServers: Record<string, ServerConfig>;
    };

    for (const [name, server] of Object.entries(config.mcpServers)) {
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        cwd,
        env: cleanEnv(),
      });
      const client = new Client({ name: `obol-agent:${name}`, version: "0.1.0" });
      await client.connect(transport);
      this.clients.set(name, client);

      const { tools } = await client.listTools();
      for (const tool of tools) {
        this.toolToServer.set(tool.name, name);
        this.tools.push({
          name: tool.name,
          description: tool.description ?? "",
          input_schema: tool.inputSchema as AnthropicTool["input_schema"],
        });
      }
    }
  }

  /** Every connected tool, ready to pass to the Messages API. */
  anthropicTools(): AnthropicTool[] {
    return this.tools;
  }

  /** Calls a tool by name and returns its text content. */
  async call(toolName: string, args: Record<string, unknown>): Promise<string> {
    const serverName = this.toolToServer.get(toolName);
    const client = serverName ? this.clients.get(serverName) : undefined;
    if (!client) throw new Error(`No MCP server provides the tool "${toolName}"`);

    const result = await client.callTool({ name: toolName, arguments: args });
    const text = Array.isArray(result.content)
      ? result.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("\n")
      : "";
    if (result.isError) throw new Error(text || `Tool "${toolName}" failed`);
    return text;
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.clients.values()].map((c) => c.close()));
  }
}

const resolveConfig = (agentDir: string): string => resolve(agentDir, ".mcp.json");
export { resolveConfig };

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  return env;
}
