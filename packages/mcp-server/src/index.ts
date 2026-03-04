import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createNexusMcpServer } from './server.js';

const PORT = parseInt(process.env['PORT'] ?? '4200', 10);

const server = createServer(async (req, res) => {
  // MCP endpoint (stateless mode)
  if (req.url === '/mcp' || req.url?.startsWith('/mcp?')) {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const mcp = createNexusMcpServer();
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'nexus-mcp', version: '0.1.0' }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`NEXUS MCP server listening on http://localhost:${PORT}/mcp`);
});
