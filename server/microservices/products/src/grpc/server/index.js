import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProductGrpcService } from './services/product.grpc.service.js';
import logger from '../../utils/logger.js';

let grpcServer = null;

// Load proto file
function loadProto() {
  const PROTO_PATH = path.join(process.cwd(), 'protos', 'product.proto');

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  return grpc.loadPackageDefinition(packageDefinition).product;
}

// Create gRPC server and register services
function createGrpcServer() {
  try {
    const server = new grpc.Server();
    const proto = loadProto();

    // Register ProductService
    server.addService(proto.ProductService.service, {
      GetVariantDetails: ProductGrpcService.GetVariantDetails,
      ReserveStock: ProductGrpcService.reserveStock,
      ReleaseReservedStock: ProductGrpcService.ReleaseReservedStock,
    });

    logger.info('[gRPC] Server created successfully');
    return server;
  } catch (error) {
    logger.error('[gRPC] Failed to create server:', error);
    throw error;
  }
}

// Start gRPC server
export async function startGrpcServer(port = '50053') {
  return new Promise((resolve, reject) => {
    try {
      grpcServer = createGrpcServer();

      grpcServer.bindAsync(
        `0.0.0.0:${port}`,
        grpc.ServerCredentials.createInsecure(),
        (error, bindPort) => {
          if (error) {
            logger.error(`[gRPC] Failed to bind server on port ${port}:`, error);
            reject(error);
            return;
          }

          logger.info(`[gRPC] Product Service listening on port ${bindPort}`);
          resolve(grpcServer);
        }
      );
    } catch (error) {
      logger.error('[gRPC] Error starting server:', error);
      reject(error);
    }
  });
}

// Stop gRPC server gracefully
export async function stopGrpcServer() {
  return new Promise((resolve) => {
    if (!grpcServer) {
      resolve();
      return;
    }

    logger.info('[gRPC] Shutting down server...');

    grpcServer.tryShutdown((error) => {
      if (error) {
        logger.warn('[gRPC] Force shutting down server...');
        grpcServer.forceShutdown();
      } else {
        logger.info('[gRPC] Server stopped gracefully');
      }
      grpcServer = null;
      resolve();
    });
  });
}

export default { startGrpcServer, stopGrpcServer };
