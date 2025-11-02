import app from "./src/app.js";
import getConfig from "./src/config/config_keys.js";
import connectToDb from "./src/db/db.js";
import { startGrpcServer, stopGrpcServer } from "./src/grpc/server/index.js";
import logger from "./src/utils/logger.js";

connectToDb();

const port = getConfig('port');
const grpcPort = getConfig('grpcPort') || '50052';

// Start HTTP server
const httpServer = app.listen(port, () => {
    logger.info(`[HTTP] Auth service is running on port ${port}`);
    console.log(`Auth service is running on port ${port}`);
});

// Start gRPC server
startGrpcServer(grpcPort)
    .then((boundPort) => {
        logger.info(`[gRPC] Auth service started on port ${boundPort}`);
        console.log(`Auth gRPC service is running on port ${boundPort}`);
    })
    .catch((error) => {
        logger.error(`[gRPC] Failed to start gRPC server: ${error.message}`);
        console.error('Failed to start gRPC server:', error);
    });

// Graceful shutdown
const shutdown = async (signal) => {
    logger.info(`\n${signal} received. Starting graceful shutdown...`);
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    // Close HTTP server
    httpServer.close(() => {
        logger.info('[HTTP] Server closed');
        console.log('HTTP server closed');
    });

    // Close gRPC server
    await stopGrpcServer();

    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
