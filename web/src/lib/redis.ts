import Redis from "ioredis";

// Reuse one connection across hot reloads in development.
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
    globalForRedis.redis ??
    new Redis(process.env.REDIS_URL as string, {
        // Don't connect while `next build` merely imports route modules.
        lazyConnect: true,
    });

if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = redis;
}
