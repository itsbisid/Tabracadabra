import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      {
        name: 'tabracadabra-local-api',
        configureServer(server) {
          server.middlewares.use('/api/send-email', async (request, response) => {
            const { default: handler } = await import('./api/send-email.js');
            await handler(request, response);
          });
        }
      }
    ]
  };
});
