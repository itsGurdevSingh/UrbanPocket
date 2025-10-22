import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middlewares/errorHandler.js';
import { globalRateLimiter } from './middlewares/rateLimiter.js';
import { ApiResponse } from './utils/success.js';
import { ApiError } from './utils/errors.js';
import cartRouter from './routers/cart.router.js';

const app = express();

const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    process.env.OPEN_API_URL || 'http://localhost:3000'
];

const isProd = (process.env.NODE_ENV || 'development') === 'production';

// CORS middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow all origins in non-production to make local tools (Swagger UI, editors) work smoothly
        if (!isProd) return callback(null, true);

        // In production, allow only configured origins (and non-browser requests with no origin)
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);

        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global rate limiter - protect all routes from abuse
app.use(globalRateLimiter);

// Routes
app.use('/api/cart', cartRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json(

        new ApiResponse({ timestamp: new Date().toISOString(), service: 'cart-microservice' }, 'ok')
    );
});

// 404 handler -> forward to error handler using ApiError
app.use('*unknown', (req, res, next) => {
    next(new ApiError('Route not found', { statusCode: 404, code: 'ROUTE_NOT_FOUND', details: { path: req.originalUrl } }));
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;