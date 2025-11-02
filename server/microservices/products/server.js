import app from './src/app.js';
import connectToDb from './src/db/db.js';
import getConfig from './src/config/config_keys.js';
import logger from './src/utils/logger.js';
import { startGrpcServer, stopGrpcServer } from './src/grpc/server/index.js';

const PORT = getConfig('port');
const GRPC_PORT = getConfig('grpcPort') || '50053';

let httpServer;

const startServer = async () => {
    try {
        // Connect to database
        await connectToDb();

        // Start HTTP server
        httpServer = app.listen(PORT, () => {
            logger.info(`Product service is running on port ${PORT}`);
            logger.info(`Environment: ${getConfig('nodeEnv')}`);
        });

        // Start gRPC server
        await startGrpcServer(GRPC_PORT);
        logger.info(`gRPC server started on port ${GRPC_PORT}`);

    } catch (error) {
        logger.error('Failed to start server:', { error });
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);

    // Close HTTP server
    if (httpServer) {
        httpServer.close(() => {
            logger.info('HTTP server closed');
        });
    }

    // Close gRPC server
    await stopGrpcServer();

    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();