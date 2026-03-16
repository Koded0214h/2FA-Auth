import { createClient } from 'redis';

declare global {
  // eslint-disable-next-line no-var
  var _redisClient: ReturnType<typeof createClient> | undefined;
}

const redisClient = global._redisClient ?? createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

if (!redisClient.isOpen) {
  redisClient.connect();
}

if (process.env.NODE_ENV !== 'production') {
  global._redisClient = redisClient;
}

export default redisClient;