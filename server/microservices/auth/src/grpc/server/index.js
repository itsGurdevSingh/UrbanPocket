import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import authGrpcService from './services/auth.grpc.service.js';
import logger from '../../utils/logger.js';

/**
 * gRPC Server Configuration and Initialization
 * Handles server startup, proto loading, and graceful shutdown
 */

let grpcServer = null;

/**
 * Load proto file and create service definition
 */
const loadProto = () => {
    // Use path relative to project root (works in both production and test)
    const PROTO_PATH = path.join(process.cwd(), 'protos', 'auth.proto'); const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    });

    const authProto = grpc.loadPackageDefinition(packageDefinition).auth;
    return authProto;
};

/**
 * Create and configure gRPC server
 */
export const createGrpcServer = () => {
    try {
        const server = new grpc.Server();
        const authProto = loadProto();

        // Register AuthService with its implementation
        server.addService(authProto.AuthService.service, {
            GetAddress: authGrpcService.GetAddress,
        });

        grpcServer = server;
        logger.info('[gRPC] Server created successfully');
        return server;
    } catch (error) {
        logger.error(`[gRPC] Failed to create server: ${error.message}`, { error: error.stack });
        throw error;
    }
};

/**
 * Start gRPC server on specified port
 */
export const startGrpcServer = (port = '50052') => {
    return new Promise((resolve, reject) => {
        try {
            if (!grpcServer) {
                grpcServer = createGrpcServer();
            }

            const serverAddress = `0.0.0.0:${port}`;

            grpcServer.bindAsync(
                serverAddress,
                grpc.ServerCredentials.createInsecure(),
                (error, boundPort) => {
                    if (error) {
                        logger.error(`[gRPC] Failed to bind server: ${error.message}`);
                        return reject(error);
                    }

                    logger.info(`[gRPC] Auth Service listening on port ${boundPort}`);
                    resolve(boundPort);
                }
            );
        } catch (error) {
            logger.error(`[gRPC] Failed to start server: ${error.message}`, { error: error.stack });
            reject(error);
        }
    });
};

/**
 * Gracefully shutdown gRPC server
 */
export const stopGrpcServer = () => {
    return new Promise((resolve) => {
        if (!grpcServer) {
            logger.info('[gRPC] No server to stop');
            return resolve();
        }

        logger.info('[gRPC] Shutting down server...');

        grpcServer.tryShutdown((error) => {
            if (error) {
                logger.error(`[gRPC] Error during shutdown: ${error.message}`);
                grpcServer.forceShutdown();
            } else {
                logger.info('[gRPC] Server stopped gracefully');
            }
            grpcServer = null;
            resolve();
        });
    });
};

export default {
    createGrpcServer,
    startGrpcServer,
    stopGrpcServer,
};
