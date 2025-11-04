import ReserveStock from '../models/reserveStock.model.js';
import InventoryItem from '../models/inventory.model.js';
import { ApiError } from '../utils/errors.js';
import variantRepository from './variant.repository.js';

class ReservationRepository {
    constructor() {
        this.model = ReserveStock;
    }
    async createReservation(variantId, quantity,reservaionId) {

        //check if stock is available
        const variant = await variantRepository.findById(variantId);
        if (!variant || variant.stock < quantity) {
            throw new ApiError('INSUFFICIENT_STOCK', `Insufficient stock for variant ${variantId}. Requested: ${quantity}, Available: ${variant ? variant.stock : 0}`);
        }

        //get expire first inventory to match the quantity
        const batches = await InventoryItem.findFefoBatchesForReservation(variantId, quantity);

        const reservation = new this.model({
            variantId,
            totalQuantity: quantity,
            inventoryEntries: batches,
            reservationId
        });
        return await reservation.save();
    }

    async getReservationById(reservationId) {
        return await this.model.findById(reservationId);
    }

    async getReservationByOrderId(orderId) {
        return await this.model.findOne({ reservationId: orderId });
    }
}

export default new ReservationRepository();