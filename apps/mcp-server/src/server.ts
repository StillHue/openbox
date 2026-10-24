import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBoxTools } from './tools/boxes.js';
import { registerDocumentTools } from './tools/documents.js';
import { registerGraphTools } from './tools/graph.js';
import { registerQueryTools } from './tools/query.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'openbox',
    version: '1.0.0',
  });

  registerQueryTools(server);
  registerDocumentTools(server);
  registerGraphTools(server);
  registerBoxTools(server);

  return server;
}
