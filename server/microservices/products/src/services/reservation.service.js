import reservationRepository from '../repositories/reservation.repository.js';
import InventoryItem from '../models/inventory.model.js';
import { ApiError } from '../utils/errors.js';

class ReservationService {
    /*reserve stock for a variant
     * @param {Object} call - gRPC call object containing request data
     * resuest will contain variantId, quantity , reservaionId(orderId).
     * @param {object} send resopnse with reserve id 
     */
    async reserveStock(data) {
        try {
            const { variantId, quantity } = data;
            // Reserve stock using FEFO logic
            const reservation = await reservationRepository.createReservation(variantId, quantity, reservation);

            return {
                success: true,
                reserveId: reservation._id.toString(),
                message: 'Stock reserved successfully'
            };
        }
        catch (err) {
            return {
                success: false,
                reserveId: null,
                message: 'Error reserving stock: ' + err.message
            };
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
            if(!reserveId && !reservationId) {
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
            //take inventory entries from reservation and update stock back in inventory
            const stockReleasePromises = reservation.inventoryEntries.map((entry) => {
                return InventoryItem.findByIdAndUpdate(entry.inventoryId, {
                    $inc: { stock: entry.quantity },
                });
            });
            await Promise.all(stockReleasePromises);
            //after stock is released delete the reservation
            await reservation.deleteOne();

            return {
                success: true,
                message: 'Reserved stock released successfully'
            };
        } catch (err) {
            return {
                success: false,
                message: 'Error releasing reserved stock: ' + err.message
            };
        }
    }
}

export default new ReservationService();