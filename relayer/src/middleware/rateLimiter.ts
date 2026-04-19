import { Request, Response, NextFunction } from 'express';
import type { Redis } from 'ioredis';

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    message?: string;
}

/**
 * Rate limiter with optional Redis backend.
 * Falls back to in-memory if Redis is unavailable or throws.
 */
export class RateLimiter {
    private store: RateLimitStore = {};
    private config: RateLimitConfig;
    private redisClient: Redis | null;

    constructor(config: RateLimitConfig, redisClient?: Redis | null) {
        this.config = {
            windowMs: config.windowMs || 60000,
            maxRequests: config.maxRequests || 100,
            message: config.message || 'Too many requests, please try again later.'
        };
        this.redisClient = redisClient || null;
        setInterval(() => this.cleanup(), 60000);
    }

    private async getCountFromRedis(identifier: string): Promise<number | null> {
        if (!this.redisClient) return null;
        try {
            const key = `ratelimit:key:${identifier}`;
            const windowSeconds = Math.ceil(this.config.windowMs / 1000);
            const count = await this.redisClient.incr(key);
            if (count === 1) {
                // First increment — set expiry for the window
                await this.redisClient.expire(key, windowSeconds);
            }
            return count;
        } catch {
            return null; // Fall back to in-memory silently
        }
    }

    public middleware() {
        return async (req: Request & { apiKeyId?: string }, res: Response, next: NextFunction) => {
            const identifier = req.apiKeyId || req.ip || 'anonymous';
            const now = Date.now();

            // Try Redis first
            const redisCount = await this.getCountFromRedis(identifier);
            if (redisCount !== null) {
                if (redisCount > this.config.maxRequests) {
                    const windowSeconds = Math.ceil(this.config.windowMs / 1000);
                    res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
                    res.setHeader('X-RateLimit-Remaining', '0');
                    res.setHeader('Retry-After', windowSeconds.toString());
                    return res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: this.config.message,
                        retryAfter: windowSeconds
                    });
                }
                res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
                res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - redisCount).toString());
                return next();
            }

            // In-memory fallback
            if (!this.store[identifier] || now > this.store[identifier].resetTime) {
                this.store[identifier] = { count: 0, resetTime: now + this.config.windowMs };
            }

            const record = this.store[identifier];

            if (record.count >= this.config.maxRequests) {
                const retryAfter = Math.ceil((record.resetTime - now) / 1000);
                res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
                res.setHeader('X-RateLimit-Remaining', '0');
                res.setHeader('X-RateLimit-Reset', record.resetTime.toString());
                res.setHeader('Retry-After', retryAfter.toString());
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: this.config.message,
                    retryAfter
                });
            }

            record.count++;
            res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', (this.config.maxRequests - record.count).toString());
            res.setHeader('X-RateLimit-Reset', record.resetTime.toString());
            next();
        };
    }

    private cleanup() {
        const now = Date.now();
        Object.keys(this.store).forEach(key => {
            if (now > this.store[key].resetTime) delete this.store[key];
        });
    }

    public reset(identifier: string) { delete this.store[identifier]; }
    public getStats(identifier: string) { return this.store[identifier] || null; }
}

/**
 * IP-based rate limiter with optional Redis backend.
 * Falls back to in-memory if Redis is unavailable or throws.
 * Uses X-Forwarded-For when behind a proxy (Render, Vercel, etc.).
 */
export class IpRateLimiter {
    private store: RateLimitStore = {};
    private config: RateLimitConfig;
    private redisClient: Redis | null;

    constructor(config: RateLimitConfig, redisClient?: Redis | null) {
        this.config = {
            windowMs: config.windowMs || 60000,
            maxRequests: config.maxRequests || 60,
            message: config.message || 'Too many requests from this IP, please try again later.'
        };
        this.redisClient = redisClient || null;
        setInterval(() => this.cleanup(), 60000);
    }

    private getIp(req: Request): string {
        // Respect X-Forwarded-For when behind a reverse proxy
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
            return ips[0].trim();
        }
        return req.ip || req.socket?.remoteAddress || 'unknown';
    }

    private async getCountFromRedis(ip: string): Promise<number | null> {
        if (!this.redisClient) return null;
        try {
            const key = `ratelimit:ip:${ip}`;
            const windowSeconds = Math.ceil(this.config.windowMs / 1000);
            const count = await this.redisClient.incr(key);
            if (count === 1) {
                await this.redisClient.expire(key, windowSeconds);
            }
            return count;
        } catch {
            return null; // Fall back to in-memory silently
        }
    }

    public middleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            const ip = this.getIp(req);
            const now = Date.now();

            // Try Redis first
            const redisCount = await this.getCountFromRedis(ip);
            if (redisCount !== null) {
                if (redisCount > this.config.maxRequests) {
                    const windowSeconds = Math.ceil(this.config.windowMs / 1000);
                    res.setHeader('X-RateLimit-IP-Limit', this.config.maxRequests.toString());
                    res.setHeader('X-RateLimit-IP-Remaining', '0');
                    res.setHeader('Retry-After', windowSeconds.toString());
                    return res.status(429).json({
                        error: 'IP rate limit exceeded',
                        message: this.config.message,
                        retryAfter: windowSeconds
                    });
                }
                res.setHeader('X-RateLimit-IP-Limit', this.config.maxRequests.toString());
                res.setHeader('X-RateLimit-IP-Remaining', Math.max(0, this.config.maxRequests - redisCount).toString());
                return next();
            }

            // In-memory fallback
            if (!this.store[ip] || now > this.store[ip].resetTime) {
                this.store[ip] = { count: 0, resetTime: now + this.config.windowMs };
            }

            const record = this.store[ip];

            if (record.count >= this.config.maxRequests) {
                const retryAfter = Math.ceil((record.resetTime - now) / 1000);
                res.setHeader('X-RateLimit-IP-Limit', this.config.maxRequests.toString());
                res.setHeader('X-RateLimit-IP-Remaining', '0');
                res.setHeader('Retry-After', retryAfter.toString());
                return res.status(429).json({
                    error: 'IP rate limit exceeded',
                    message: this.config.message,
                    retryAfter
                });
            }

            record.count++;
            res.setHeader('X-RateLimit-IP-Limit', this.config.maxRequests.toString());
            res.setHeader('X-RateLimit-IP-Remaining', (this.config.maxRequests - record.count).toString());
            next();
        };
    }

    private cleanup() {
        const now = Date.now();
        Object.keys(this.store).forEach(key => {
            if (now > this.store[key].resetTime) delete this.store[key];
        });
    }
}

/**
 * Create rate limiters for all endpoint types.
 * Passes the shared Redis client so limits persist across restarts.
 */
export const createRateLimiters = (redisClient?: import('ioredis').Redis | null) => {
    return {
        estimate: new RateLimiter({
            windowMs: 60000,
            maxRequests: 60,
            message: 'Too many fee estimation requests. Please slow down.'
        }, redisClient),
        estimateIp: new IpRateLimiter({
            windowMs: 60000,
            maxRequests: 120,  // Higher than per-key since multiple keys can share an IP legitimately
            message: 'Too many estimation requests from this IP.'
        }, redisClient),

        sponsor: new RateLimiter({
            windowMs: 60000,
            maxRequests: 30,
            message: 'Too many sponsorship requests. Please slow down.'
        }, redisClient),
        sponsorIp: new IpRateLimiter({
            windowMs: 60000,
            maxRequests: 40,
            message: 'Too many sponsorship requests from this IP.'
        }, redisClient),

        broadcast: new RateLimiter({
            windowMs: 60000,
            maxRequests: 20,
            message: 'Too many broadcast requests. Please slow down.'
        }, redisClient),
        broadcastIp: new IpRateLimiter({
            windowMs: 60000,
            maxRequests: 30,
            message: 'Too many broadcast requests from this IP.'
        }, redisClient),

        dashboard: new RateLimiter({
            windowMs: 60000,
            maxRequests: 120,
            message: 'Too many dashboard requests. Please slow down.'
        }, redisClient),
        dashboardIp: new IpRateLimiter({
            windowMs: 60000,
            maxRequests: 200,
            message: 'Too many dashboard requests from this IP.'
        }, redisClient)
    };
};
