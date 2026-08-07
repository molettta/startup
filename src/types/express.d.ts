import type { AuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware `authenticate`. */
      user?: AuthUser;
    }
  }
}

export {};
