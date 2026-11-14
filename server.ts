import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './server/routes.ts';

export async function createApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/v1', createApiRouter());

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(500).json({ error: message });
  });

  return app;
}

function resolveServerPort(): number {
  const portFlagIdx = process.argv.indexOf('--port');
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const cliPort = Number(process.argv[portFlagIdx + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) return cliPort;
  }
  return Number(process.env.PORT || 3000);
}

async function startServer() {
  const app = await createApp();
  const httpServer = http.createServer(app);
  const port = resolveServerPort();

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const enableHmr = process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true';
    if (!enableHmr) {
      process.env.DISABLE_HMR = 'true';
    }
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: enableHmr ? { server: httpServer } : false,
        ws: enableHmr ? { server: httpServer } : false,
        watch: enableHmr ? undefined : null,
      },
      appType: 'spa',
    });

    if (!enableHmr) {
      app.use((req, res, next) => {
        if (req.path !== '/@vite/client') return next();
        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);
        const chunks: Buffer[] = [];
        res.write = ((chunk: unknown) => {
          if (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          }
          return true;
        }) as typeof res.write;
        res.end = ((chunk?: unknown) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          }
          if (chunks.length === 0) {
            res.write = origWrite;
            res.end = origEnd;
            return origEnd();
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          const patched = raw
            .replace('async connect(handlers) {', 'async connect(handlers) { return;')
            .replace('async disconnect() {', 'async disconnect() { return;')
            .replace('send(data) {', 'send(data) { return;');
          const outBuf = Buffer.from(patched, 'utf8');
          res.removeHeader('Content-Length');
          res.setHeader('Content-Length', String(outBuf.length));
          res.write = origWrite;
          res.end = origEnd;
          return origEnd(outBuf);
        }) as typeof res.end;
        return next();
      });
    }

    app.use(vite.middlewares);
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Al-Furqaan Markaz server listening on http://0.0.0.0:${port}`);
  });
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Failed to start Al-Furqaan Markaz server:', err);
    process.exit(1);
  });
}
