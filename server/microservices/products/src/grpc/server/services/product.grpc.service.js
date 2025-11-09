import * as grpc from '@grpc/grpc-js';
import variantRepository from '../../../repositories/variant.repository.js';
import logger from '../../../utils/logger.js';
import reservationRepository from '../../../repositories/reservation.repository.js';
import reservationService from '../../../services/reservation.service.js';

export const ProductGrpcService = {
    /**
     * Get variant details by variantId
     * @param {Object} call - gRPC call object containing request data
     * @param {Function} callback - Callback function to send response
     */
    GetVariantDetails: async (call, callback) => {
        const { variantId } = call.request;

        try {
            logger.info(`[gRPC] GetVariantDetails called - variantId: ${variantId}`);

            // Validate variantId
            if (!variantId) {
                logger.error('[gRPC] GetVariantDetails validation error: variantId is required');
                return callback(null, {
                    success: false,
                    variant: null,
                    message: 'Variant not found',
                    error: {
                        code: 'NOT_FOUND',
                        message: 'variantId is required',
                        details: ['variantId parameter is missing']
                    }
                });
            }

            // Fetch variant from repository
            const variant = await variantRepository.findById(variantId);

            // Convert Map to plain object for options
            const optionsObject = {};
            if (variant.options) {
                variant.options.forEach((value, key) => {
                    optionsObject[key] = value;
                });
            }

            // Prepare variant response
            const variantResponse = {
                id: variant._id.toString(),
                productId: variant.productId.toString(),
                sku: variant.sku || '',
                options: optionsObject,
                price: {
                    amount: variant.price.amount,
                    currency: variant.price.currency
                },
                stock: variant.stock,
                baseUnit: variant.baseUnit,
                variantImages: variant.variantImages.map(img => ({
                    url: img.url,
                    altText: img.altText || '',
                    fileId: img.fileId || ''
                })),
                isActive: variant.isActive
            };

            logger.info(`[gRPC] GetVariantDetails successful - variantId: ${variantId}`);

            // Success response
            callback(null, {
                success: true,
                variant: variantResponse,
                message: 'Variant retrieved successfully',
                error: null
            });

        } catch (err) {
            logger.error(`[gRPC] GetVariantDetails error: ${err.message}`, { error: err });

            // Handle Variant not found error
            if (err.message.includes('Variant not found')) {
                return callback(null, {
                    success: false,
                    variant: null,
                    message: 'Variant not found',
                    error: {
                        code: 'NOT_FOUND',
                        message: err.message,
                        details: [`No variant found with ID: ${variantId}`]
                    }
                });
            }

            // Handle CastError (invalid ObjectId format)
            if (err.name === 'CastError' || err.message.includes('Cast to ObjectId failed')) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: err.message
                });
            }

            // Handle other errors
            callback({
                code: grpc.status.INTERNAL,
                message: err.message || 'Internal server error'
            });
        }
    },

    /*reserve stock for a variant
     * @param {Object} call - gRPC call object containing request data
     * @param {object} send resopnse with reserve id 
     */
    reserveStock: async (call, callback) => {
        try {
            const { variantId, quantity, reservationId } = call.request;

            logger.info(`[gRPC] ReserveStock called - variantId: ${variantId}, quantity: ${quantity}, reservationId: ${reservationId}`);

            // Validate inputs
            if (!variantId) {
                logger.error('[gRPC] ReserveStock validation error: variantId is required');
                return callback(null, {
                    success: false,
                    reserveId: '',
                    message: 'Reservation failed',
                    error: {
                        code: 'INVALID_ARGUMENT',
                        message: 'variantId is required',
                        details: ['variantId parameter is missing']
                    }
                });
            }

            if (!quantity || quantity <= 0) {
                logger.error('[gRPC] ReserveStock validation error: quantity must be positive');
                return callback(null, {
                    success: false,
                    reserveId: '',
                    message: 'Reservation failed',
                    error: {
                        code: 'INVALID_ARGUMENT',
                        message: 'quantity must be a positive integer',
                        details: [`Invalid quantity: ${quantity}`]
                    }
                });
            }

            if (!reservationId) {
                logger.error('[gRPC] ReserveStock validation error: reservationId is required');
                return callback(null, {
                    success: false,
                    reserveId: '',
                    message: 'Reservation failed',
                    error: {
                        code: 'INVALID_ARGUMENT',
                        message: 'reservationId is required',
                        details: ['reservationId parameter is missing']
                    }
                });
            }

            // Reserve stock using FEFO logic
            const reservation = await reservationService.reserveStock({ variantId, quantity, reservationId });

            logger.info(`[gRPC] ReserveStock successful - reserveId: ${reservation._id}, reservationId: ${reservationId}`);

            return callback(null, {
                success: true,
                reserveId: reservation._id.toString(),
                message: 'Stock reserved successfully',
                error: null
            });
        } catch (err) {
            logger.error(`[gRPC] ReserveStock error: ${err.code || 'UNKNOWN'}`, { error: err });

            // Check if it's an ApiError with a code property
            const errorCode = err.code || err.name;

            // Handle different error codes
            switch (errorCode) {
                case 'INSUFFICIENT_STOCK':
                    return callback(null, {
                        success: false,
                        reserveId: '',
                        message: 'Insufficient stock',
                        error: {
                            code: 'INSUFFICIENT_STOCK',
                            message: err.message,
                            details: []
                        }
                    });

                case 'NOT_FOUND':
                    return callback(null, {
                        success: false,
                        reserveId: '',
                        message: 'Variant not found',
                        error: {
                            code: 'NOT_FOUND',
                            message: err.message,
                            details: [`No variant found with ID: ${call.request.variantId}`]
                        }
                    });

                case 'INVALID_REQUEST':
                case 'INVALID_INPUT':
                    return callback(null, {
                        success: false,
                        reserveId: '',
                        message: 'Invalid request',
                        error: {
                            code: 'INVALID_ARGUMENT',
                            message: err.message,
                            details: []
                        }
                    });

                case 'STOCK_DEDUCTION_FAILED':
                    return callback(null, {
                        success: false,
                        reserveId: '',
                        message: 'Failed to deduct stock',
                        error: {
                            code: 'INTERNAL',
                            message: err.message,
                            details: []
                        }
                    });

                case 'RESERVATION_FAILED':
                    return callback(null, {
                        success: false,
                        reserveId: '',
                        message: 'Failed to create reservation',
                        error: {
                            code: 'INTERNAL',
                            message: err.message,
                            details: []
                        }
                    });

                case 'CastError':
                    return callback({
                        code: grpc.status.INVALID_ARGUMENT,
                        message: 'Invalid ID format: ' + err.message
                    });

                default:
                    // Handle unknown errors
                    logger.error('[gRPC] ReserveStock unexpected error', { error: err });
                    return callback({
                        code: grpc.status.INTERNAL,
                        message: 'Error reserving stock: ' + err.message
                    });
            }
        }
    },

    /**
     * Release reserved stock - Translator between gRPC and service logic
     * @param {Object} call - gRPC call object containing request data
     * @param {Function} callback - Callback function to send response
     */
    ReleaseReservedStock: async (call, callback) => {
        try {
            const { reserveId, reservationId } = call.request;

            logger.info(`[gRPC] ReleaseReservedStock called - reserveId: ${reserveId}, reservationId: ${reservationId}`);

            // Validate inputs - at least one must be provided
            if (!reserveId && !reservationId) {
                logger.error('[gRPC] ReleaseReservedStock validation error: Either reserveId or reservationId must be provided');
                return callback(null, {
                    success: false,
                    message: 'Release failed',
                    error: {
                        code: 'INVALID_ARGUMENT',
                        message: 'Either reserveId or reservationId must be provided',
                        details: ['Both reserveId and reservationId are missing']
                    }
                });
            }

            // Call the reservation service with the data
            const result = await reservationService.releaseReservedStock({
                reserveId,
                reservationId
            });

            logger.info(`[gRPC] ReleaseReservedStock successful - reserveId: ${reserveId}, reservationId: ${reservationId}`);

            return callback(null, {
                success: true,
                message: 'Reserved stock released successfully',
                error: null
            });

        } catch (err) {
            logger.error(`[gRPC] ReleaseReservedStock error: ${err.code || 'UNKNOWN'}`, { error: err });

            // Check if it's an ApiError with a code property
            const errorCode = err.code || err.name;

            // Handle different error codes
            switch (errorCode) {
                case 'NOT_FOUND':
                    return callback(null, {
                        success: false,
                        message: 'Reservation not found',
                        error: {
                            code: 'NOT_FOUND',
                            message: err.message,
                            details: ['Reservation not found with provided ID']
                        }
                    });

                case 'INVALID_REQUEST':
                case 'INVALID_INPUT':
                    return callback(null, {
                        success: false,
                        message: 'Invalid request',
                        error: {
                            code: 'INVALID_ARGUMENT',
                            message: err.message,
                            details: []
                        }
                    });

                case 'RELEASE_FAILED':
                case 'STOCK_ADDITION_FAILED':
                    return callback(null, {
                        success: false,
                        message: 'Failed to release reserved stock',
                        error: {
                            code: 'INTERNAL',
                            message: err.message,
                            details: []
                        }
                    });

                case 'CastError':
                    return callback({
                        code: grpc.status.INVALID_ARGUMENT,
                        message: 'Invalid ID format: ' + err.message
                    });

                default:
                    // Handle unknown errors
                    logger.error('[gRPC] ReleaseReservedStock unexpected error', { error: err });
                    return callback({
                        code: grpc.status.INTERNAL,
                        message: 'Error releasing reserved stock: ' + err.message
                    });
            }
        }
    }

};