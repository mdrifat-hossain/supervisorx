import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { pool } from "./db";

export { pool };

function createAuthInstance(secret: string) {
  const socialProviders = {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  };

  return betterAuth({
    database: pool,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    secret,
    trustedOrigins: [
      ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL.replace(/\/+$/, "")] : []),
      ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []),
    ],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    socialProviders,
    plugins: [username()],
  });
}

export type Auth = ReturnType<typeof createAuthInstance>;

let cachedAuth: Auth | undefined;

/**
 * Returns the singleton Better Auth instance.
 * Validates BETTER_AUTH_SECRET and initializes adapters lazily at runtime.
 */
export function getAuth(): Auth {
  if (!cachedAuth) {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
      throw new Error("BETTER_AUTH_SECRET is required");
    }
    cachedAuth = createAuthInstance(secret);
  }
  return cachedAuth;
}

/**
 * Lazy proxy wrapping the Better Auth instance.
 * Prevents build-time module evaluation from failing when secrets are only available at runtime.
 */
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    if (prop === "then") return undefined;
    const instance = getAuth();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
  has(_target, prop) {
    if (prop === "then") return false;
    if (cachedAuth) {
      return Reflect.has(cachedAuth, prop);
    }
    if (prop === "handler" || prop === "api" || prop === "options") {
      return true;
    }
    const instance = getAuth();
    return Reflect.has(instance, prop);
  },
});

