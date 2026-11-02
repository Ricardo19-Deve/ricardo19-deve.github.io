import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { createHandler, jsonResponse } from './core.mjs';
import { MemoryQuota } from './quota.mjs';

// Local-only adapter. It ignores Forwarded, X-Forwarded-For and CF-Connecting-IP;
// direct socket identity is authoritative here. Do not expose behind a proxy.
export function createNodeServer({ env = process.env, fetchImpl, quota = new MemoryQuota() } = {}) {
  const handle = createHandler({ env, fetchImpl, quota });
  const server = createServer(async (incoming, outgoing) => {
    const controller = new AbortController();
    const onAborted = () => controller.abort();
    // IncomingMessage also emits close after a normally completed request body.
    // Only an incomplete body or a response closed before finish is cancellation.
    const onIncomingClose = () => { if (!incoming.complete) controller.abort(); };
    const onResponseClose = () => { if (!outgoing.writableFinished) controller.abort(); };
    incoming.once('aborted', onAborted);
    incoming.once('close', onIncomingClose);
    outgoing.once('close', onResponseClose);
    if (incoming.aborted || (incoming.destroyed && !incoming.complete)) controller.abort();
    try {
      const request = new Request(new URL(incoming.url, 'http://127.0.0.1:4184'), {
        method: incoming.method, headers: incoming.headers, signal: controller.signal,
        ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {})
      });
      const response = await handle(request, { clientIp: incoming.socket.remoteAddress || 'unknown' });
      const body = await response.text();
      if (controller.signal.aborted || outgoing.destroyed) return;
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(body);
    } catch {
      if (controller.signal.aborted || outgoing.destroyed) return;
      if (!outgoing.headersSent) {
        const response = jsonResponse({ error: { code: 'invalid_request', message: 'Please send a valid portfolio question.' } }, 400);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(await response.text());
      } else outgoing.end();
    } finally {
      incoming.removeListener('aborted', onAborted);
      incoming.removeListener('close', onIncomingClose);
      outgoing.removeListener('close', onResponseClose);
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.timeout = 25000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.M_AI_PORT || 4184);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('M_AI_PORT must be an integer between 1024 and 65535.');
  createNodeServer().listen(port, '127.0.0.1', () => console.log(`M local backend: http://127.0.0.1:${port} (memory quotas; local development only)`));
}
