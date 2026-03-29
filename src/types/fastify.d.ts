import '@fastify/jwt';

import type { UserRole } from '../db/schema';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: UserRole;
      email: string;
    };
    user: {
      sub: string;
      role: UserRole;
      email: string;
    };
  }
}
