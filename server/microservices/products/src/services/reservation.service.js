import reservationRepository from '../repositories/reservation.repository.js';
import InventoryItem from '../models/inventory.model.js';
import { ApiError } from '../utils/errors.js';
import variantRepository from '../repositories/variant.repository.js';
import InventoryItemRepository from '../repositories/InventoryItemRepository.js';
import mongoose from 'mongoose';

class ReservationService {
    /*reserve stock for a variant
     * @param {Object} call - gRPC call object containing request data
     * resuest will contain variantId, quantity , reservaionId(orderId).
     * @param {object} send resopnse with reserve id 
     */
    async reserveStock(data) {
        const session = await mongoose.startSession();
        try {
            const { variantId, quantity, reservationId } = data;

            //check all filds are present
            if (!variantId || !quantity || quantity <= 0 || !reservationId) {
                throw new ApiError('INVALID_REQUEST', 'variantId, positive quantity and reservationId are required to reserve stock');
            }

            // check is varient has enough stock and reserve using FEFO logic
            const variant = await variantRepository.findById(variantId);
            if (!variant) {
                throw new ApiError('NOT_FOUND', `Variant with id ${variantId} not found`);
            }
            if (variant.stock < quantity) {
                throw new ApiError('INSUFFICIENT_STOCK', `Not enough stock for variant ${variantId}. Requested: ${quantity}, Available: ${variant.stock}`);
            }

            const findBatches = await InventoryItemRepository.findFefoBatches(variantId, quantity);

            if (!findBatches || findBatches.length === 0) {
                throw new ApiError('INSUFFICIENT_STOCK', `Not enough stock batches available for variant ${variantId}`);
            }

            session.startTransaction();
            // deduct stock from inventory batches
            await InventoryItemRepository.deductStockFromBatches(findBatches, variantId, session);

            // create reservation record
            const reservation = await reservationRepository.createReservation({
                variantId,
                quantity,
                batches: findBatches,
                reservationId
            }, session);

            await session.commitTransaction();

            return reservation;
        }
        catch (err) {


            if (session.inTransaction()) {
                session.abortTransaction();
            }
            // Re-throw ApiErrors as-is
            if (err instanceof ApiError) {
                throw err;
            }
            // Log for debugging
            console.error('Error in reserveStock:', err);
            console.error('Error type:', err.constructor.name);
            console.error('Error stack:', err.stack);
            // Wrap other errors
            throw new ApiError('RESERVATION_FAILED', 'Error reserving stock: ' + err.message);
        }
        finally {
            session.endSession();
        }
    }

    /*release reserved stock for a variant
     * @param {Object} call - gRPC call object containing request data
     * resuest will contain reservationId(orderId).
     * @param {object} send resopnse with status of release
     */
    async releaseReservedStock(data) {
        try {
            const { reserveId, reservationId } = data;

            // one of reserveId or reservationId will be present
            if (!reserveId && !reservationId) {
                throw new ApiError('INVALID_REQUEST', 'Either reserveId or reservationId must be provided');
            }

            let reservation;
            if (reserveId) {
                reservation = await reservationRepository.getReservationById(reserveId);
            } else {
                // find reservation by ID
                reservation = await reservationRepository.getReservationByOrderId(reservationId);
            }
            // 
            if (!reservation) {
                throw new ApiError('NOT_FOUND', `Reservation not found`);
            }
            // get session for transestion from our reservation model
            const session = await mongoose.startSession();

            try {

                session.startTransaction();

                //take inventory entries from reservation and update stock back in inventory
                await InventoryItemRepository.addStockToBatch(reservation.inventoryEntries, reservation.variantId.toString(), session);

                //after stock is released delete the reservation
                await reservation.deleteOne({ session });

                await session.commitTransaction();
                return true;

            } catch (err) {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                // Re-throw ApiErrors as-is
                if (err instanceof ApiError) {
                    throw err;
                }
                throw new ApiError('RELEASE_FAILED', 'Error releasing reserved stock: ' + err.message);
            } finally {
                session.endSession();
            }

            // structure response by contoller or grpc function.

        } catch (err) {
            // Re-throw ApiErrors as-is
            if (err instanceof ApiError) {
                throw err;
            }
            throw new ApiError('RELEASE_FAILED', 'Error releasing reserved stock: ' + err.message);
        }
    }
}

export default new ReservationService();