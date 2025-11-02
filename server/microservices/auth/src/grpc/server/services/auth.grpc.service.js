import * as grpc from '@grpc/grpc-js';
import authRepository from '../../../repositories/authRepository.js';
import logger from '../../../utils/logger.js';

/**
 * gRPC Service Implementation for AuthService
 * Handles incoming gRPC requests for the Auth service
 */

/**
 * GetAddress RPC Handler
 * Retrieves a specific address for a user by userId and addressId
 */
export const GetAddress = async (call, callback) => {
    const { userId, addressId } = call.request;

    try {
        logger.info(`[gRPC] GetAddress called - userId: ${userId}, addressId: ${addressId}`);

        // Validate input - return error response instead of throwing
        if (!userId || !addressId) {
            const response = {
                success: false,
                address: null,
                message: 'Address not found',
                error: {
                    code: 'NOT_FOUND',
                    message: 'userId and addressId are required',
                    details: [`userId: ${userId || 'missing'}`, `addressId: ${addressId || 'missing'}`],
                },
            };
            logger.error(`[gRPC] GetAddress validation error: userId and addressId are required`);
            return callback(null, response);
        }

        // Fetch address from repository
        const address = await authRepository.findAddressById(userId, addressId);

        // Check if address exists
        if (!address) {
            const response = {
                success: false,
                address: null,
                message: 'Address not found',
                error: {
                    code: 'NOT_FOUND',
                    message: 'No address found for the given userId and addressId',
                    details: [`userId: ${userId}`, `addressId: ${addressId}`],
                },
            };
            logger.warn(`[gRPC] GetAddress - Address not found: userId=${userId}, addressId=${addressId}`);
            return callback(null, response);
        }

        // Build success response
        const response = {
            success: true,
            address: {
                id: address._id.toString(),
                street: address.street || '',
                city: address.city || '',
                state: address.state || '',
                country: address.country || '',
                zipCode: address.zipCode || '',
            },
            message: 'Address retrieved successfully',
            error: null,
        };

        logger.info(`[gRPC] GetAddress successful - userId: ${userId}, addressId: ${addressId}`);
        callback(null, response);
    } catch (err) {
        logger.error(`[gRPC] GetAddress error: ${err.message}`, { error: err.stack });

        // Check for specific error types and return appropriate responses
        if (err.message.includes('User not found') || err.message.includes('Address not found')) {
            // These are "not found" errors from repository
            const response = {
                success: false,
                address: null,
                message: 'Address not found',
                error: {
                    code: 'NOT_FOUND',
                    message: err.message,
                    details: [`userId: ${userId}`, `addressId: ${addressId}`],
                },
            };
            return callback(null, response);
        }

        // For validation errors (like invalid ObjectId format)
        if (err.name === 'CastError' || err.message.includes('Cast to ObjectId failed')) {
            const error = {
                code: grpc.status.INVALID_ARGUMENT,
                message: err.message,
            };
            return callback(error);
        }

        // For any other internal errors
        const error = {
            code: grpc.status.INTERNAL,
            message: err.message,
        };
        callback(error);
    }
};

// Export all service methods
export default {
    GetAddress,
};
