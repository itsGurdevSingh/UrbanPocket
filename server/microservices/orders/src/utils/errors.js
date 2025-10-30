class ApiError extends Error {
    /**
     * @param {string} message
     * @param {object} options
     * @param {number} options.statusCode
     * @param {string} options.code - machine readable code
     * @param {any} options.details - optional structured details
     */
    constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details = null } = {}) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Convert various common error types (Mongoose/Mongo/Redis/others) into ApiError
 * so the global handler can respond with a consistent shape.
 */
const convertError = (err) => {
    if (!err) return new ApiError('Unknown error', {});

    // If already an ApiError, return as-is
    if (err instanceof ApiError) return err;

    // Mongoose duplicate key error (MongoServerError in newer drivers)
    if (err.name === 'MongoServerError' && err.code === 11000) {
        // keyValue often contains the duplicated field(s)
        const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
        const message = `Duplicate value for field: ${field}`;
        return new ApiError(message, { statusCode: 409, code: 'DB_DUPLICATE', details: err.keyValue || null });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const details = Object.keys(err.errors || {}).reduce((acc, k) => {
            acc[k] = err.errors[k].message;
            return acc;
        }, {});
        return new ApiError('Validation failed', { statusCode: 400, code: 'VALIDATION_ERROR', details });
    }

    // Mongoose cast error (invalid ObjectId etc.)
    if (err.name === 'CastError') {
        return new ApiError('Invalid identifier provided', { statusCode: 400, code: 'INVALID_ID', details: { path: err.path, value: err.value } });
    }

    // Redis errors (ioredis ReplyError or general connection errors)
    if (err.name && err.name.toLowerCase().includes('replyerror')) {
        return new ApiError('Cache layer error', { statusCode: 503, code: 'CACHE_ERROR', details: { message: err.message } });
    }
    if (err.message && err.message.toLowerCase().includes('redis')) {
        return new ApiError('Cache layer error', { statusCode: 503, code: 'CACHE_ERROR', details: { message: err.message } });
    }

    // JWT errors
    if (err.name === 'TokenExpiredError') {
        return new ApiError('Token expired', { statusCode: 401, code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
        return new ApiError('Invalid token', { statusCode: 401, code: 'INVALID_TOKEN' });
    }

    // HTTP-style errors where the original code was attached
    if (err.statusCode && typeof err.statusCode === 'number') {
        return new ApiError(err.message || 'Error', { statusCode: err.statusCode, code: err.code || 'ERROR', details: err.details || null });
    }

    // Default fallback
    return new ApiError(err.message || 'Internal server error', { statusCode: 500, code: 'INTERNAL_ERROR' });
};

export { ApiError, convertError };
