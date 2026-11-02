import http from 'http';
import path from 'path';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { config } from './server/config';
import { authenticate, purgeExpiredSessions } from './server/auth';
import { errorHandler } from './server/http';
import { attachRealtime } from './server/realtime';
import { apiRouter } from './server/routes';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use('/api', authenticate, apiRouter);
app.use('/api', (_req: Request, res: Response) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);

async function start() {
  const server = http.createServer(app);

  if (config.isProduction) {
    const dist = path.resolve(config.rootDir, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req: Request, res: Response) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    // Hot reload shares the app's HTTP server instead of opening another port.
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server, clientPort: config.port } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  attachRealtime(server);
  server.listen(config.port, '0.0.0.0', () => {
    console.log(`Career Code server running on http://localhost:${config.port}`);
  });

  setInterval(() => purgeExpiredSessions().catch(console.error), 60 * 60 * 1000).unref();
}

start();
