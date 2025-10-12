import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middlewares/errorHandler.js';
import productRouter from './routers/product.router.js';
import variantRouter from './routers/variant.router.js';
import storefrontRouter from './routers/storefront.router.js'

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

// Routes
app.use('/api/product', productRouter);
app.use('/api/variant', variantRouter);
app.use('/api/storefront', storefrontRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'microservice-boilerplate'
  });
});

// 404 handler
app.use('*unknown', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;