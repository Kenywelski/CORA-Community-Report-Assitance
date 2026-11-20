import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFile = fileURLToPath(import.meta.url);
const serverDirectory = path.dirname(currentFile);
const projectDirectory = path.resolve(serverDirectory, '..');

async function startServer() {
  const app = express();
  const server = createHttpServer(app);
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: projectDirectory,
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(projectDirectory, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_request, response) => {
      response.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`CORA server running on http://localhost:${port}`);
  });
}

void startServer();
