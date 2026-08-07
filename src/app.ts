import express from 'express';

import { errorHandler, notFoundHandler } from './middleware/error';
import userRoutes from './routes/user.routes';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/users', userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
