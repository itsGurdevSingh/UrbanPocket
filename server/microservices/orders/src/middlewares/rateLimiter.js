import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/errors.js';

/**
 * Global rate limiter configuration
 * Limits requests to prevent abuse and ensure fair usage
 */
export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again later.',
    handler: (req, res, next) => {
        next(
            new ApiError('Too many requests from this IP, please try again later.', {
                statusCode: 429,
                code: 'RATE_LIMIT_EXCEEDED',
                details: {
                    retryAfter: req.rateLimit.resetTime,
                    limit: req.rateLimit.limit,
                },
            })
        );
    },
    skip: (req) => {
        // Skip rate limiting for health check endpoint
        return req.path === '/health';
    },
});

/**
 * Strict rate limiter for sensitive operations
 * Lower limits for operations like order creation, payment processing, etc.
 */
export const strictRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests for this operation, please try again later.',
    handler: (req, res, next) => {
        next(
            new ApiError('Too many requests for this operation, please try again later.', {
                statusCode: 429,
                code: 'RATE_LIMIT_EXCEEDED',
                details: {
                    retryAfter: req.rateLimit.resetTime,
                    limit: req.rateLimit.limit,
                },
            })
        );
    },
});
