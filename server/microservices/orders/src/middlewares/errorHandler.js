/**
 * Global error handling middleware.
 * Returns a structured error response and logs server-side details.
 */
import logger from '../utils/logger.js';
import { convertError } from '../utils/errors.js';

export const errorHandler = (error, req, res, next) => {

    // Generate a short error id for tracing
    const errorId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // Server-side logging (include route and error id)
    const normalized = convertError(error);
    logger.error(`[Error:${errorId}] ${req.method} ${req.originalUrl} - ${normalized.message}`, {
        stack: error.stack,
        statusCode: normalized.statusCode,
        code: normalized.code,
        details: normalized.details,
    });

    // Response: expose stack only in non-production environments
    const responsePayload = {
        success: false,
        error: {
            code: normalized.code,
            message: normalized.message,
            details: normalized.details || null,
            errorId,
        }

    };

    if (process.env.NODE_ENV !== 'production') {
        responsePayload.stack = error.stack;
    }

    res.status(normalized.statusCode || 500).json(responsePayload);
};
