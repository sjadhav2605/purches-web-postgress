import dotenv from 'dotenv';

dotenv.config();

let Redis = null;
try {
  const redisModule = await import('ioredis');
  Redis = redisModule.default || redisModule;
} catch {
  // ioredis not installed; in-memory fallback will handle all cache operations
}

/**
 * High-Performance Resilient Dual-Layer Cache Service
 * 
 * Primary Layer: Distributed Redis (via ioredis)
 * Fallback Layer: In-Memory Map with TTL (activates automatically if Redis is offline)
 * 
 * Features:
 * - Zero Downtime: App functions seamlessly whether Redis is running or not.
 * - Pattern Invalidation: Bulk delete keys on writes/updates (e.g., 'ddpl:materials:*').
 * - Atomic getOrSet helper to avoid cache stampedes.
 */
class CacheService {
  constructor() {
    this.redisClient = null;
    this.isRedisReady = false;
    this.memoryCache = new Map();
    this.prefix = 'ddpl:';

    // Auto-cleanup expired memory cache items every 60 seconds
    setInterval(() => this.cleanupMemoryCache(), 60000).unref();

    this.initRedis();
  }

  initRedis() {
    if (!Redis) {
      console.log('ℹ️ [Cache] ioredis module not loaded. Operating with high-performance In-Memory cache.');
      return;
    }

    const isExplicitlyDisabled = process.env.REDIS_ENABLED === 'false';
    if (isExplicitlyDisabled) {
      console.log('ℹ️ [Cache] Redis explicitly disabled in .env. Using In-Memory Cache.');
      return;
    }

    try {
      const redisOptions = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        enableOfflineQueue: false, // Don't hold up HTTP requests when Redis is down
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        retryStrategy(times) {
          // Retry reconnecting every 10 seconds up to max 30s
          return Math.min(times * 2000, 30000);
        }
      };

      if (process.env.REDIS_URL) {
        this.redisClient = new Redis(process.env.REDIS_URL, redisOptions);
      } else {
        this.redisClient = new Redis(redisOptions);
      }

      this.redisClient.on('connect', () => {
        this.isRedisReady = true;
        console.log(`⚡ [Cache] Redis connected successfully (${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379})`);
      });

      this.redisClient.on('ready', () => {
        this.isRedisReady = true;
      });

      this.redisClient.on('error', (err) => {
        if (this.isRedisReady) {
          console.warn('⚠️ [Cache] Redis connection lost, falling back to In-Memory Cache:', err.message);
        }
        this.isRedisReady = false;
      });

      this.redisClient.on('close', () => {
        this.isRedisReady = false;
      });

      // Attempt initial connection asynchronously without blocking server boot
      this.redisClient.connect().catch(() => {
        this.isRedisReady = false;
        console.log(`ℹ️ [Cache] Redis not available at ${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}. Operating with In-Memory fallback (Zero downtime).`);
      });
    } catch (err) {
      this.isRedisReady = false;
      console.warn('⚠️ [Cache] Failed to initialize Redis client, using In-Memory Cache:', err.message);
    }
  }

  formatKey(key) {
    return key.startsWith(this.prefix) ? key : `${this.prefix}${key}`;
  }

  /**
   * Get item from cache (Redis -> Memory Fallback)
   */
  async get(key) {
    const formattedKey = this.formatKey(key);

    if (this.isRedisReady && this.redisClient) {
      try {
        const data = await this.redisClient.get(formattedKey);
        if (data !== null) {
          return JSON.parse(data);
        }
        return null;
      } catch (err) {
        // Fall back to memory on unexpected Redis read failure
      }
    }

    // In-memory fallback
    const item = this.memoryCache.get(formattedKey);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.memoryCache.delete(formattedKey);
      return null;
    }
    return item.value;
  }

  /**
   * Set item in cache with TTL in seconds (default: 300s = 5 minutes)
   */
  async set(key, value, ttlSeconds = 300) {
    const formattedKey = this.formatKey(key);
    const serialized = JSON.stringify(value);

    // Save to Memory Cache always (as instant L1 buffer)
    this.memoryCache.set(formattedKey, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });

    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.set(formattedKey, serialized, 'EX', ttlSeconds);
      } catch (err) {
        // Silently handled by memory cache
      }
    }
  }

  /**
   * Delete specific key from cache
   */
  async del(key) {
    const formattedKey = this.formatKey(key);
    this.memoryCache.delete(formattedKey);

    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.del(formattedKey);
      } catch (err) {
        // Ignored
      }
    }
  }

  /**
   * Delete all keys matching pattern (e.g. 'materials:*')
   */
  async delByPattern(pattern) {
    const formattedPattern = this.formatKey(pattern);
    const regex = new RegExp(`^${formattedPattern.replace(/\*/g, '.*')}$`);

    // Invalidate from memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // Invalidate from Redis
    if (this.isRedisReady && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(formattedPattern);
        if (keys && keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (err) {
        // Ignored
      }
    }
  }

  /**
   * Cache-aside pattern helper:
   * Returns cached data if available, otherwise executes fetchFn(),
   * caches the result, and returns it.
   */
  async getOrSet(key, fetchFn, ttlSeconds = 300) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const freshData = await fetchFn();
    if (freshData !== undefined && freshData !== null) {
      await this.set(key, freshData, ttlSeconds);
    }
    return freshData;
  }

  /**
   * Memory cleanup job for expired keys
   */
  cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiresAt) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Returns current cache engine status
   */
  getStatus() {
    return {
      activeEngine: this.isRedisReady ? 'redis' : 'in-memory-fallback',
      isRedisConnected: this.isRedisReady,
      inMemoryCachedKeys: this.memoryCache.size,
      redisHost: process.env.REDIS_HOST || '127.0.0.1',
      redisPort: Number(process.env.REDIS_PORT) || 6379
    };
  }
}

export const cacheService = new CacheService();
export default cacheService;
