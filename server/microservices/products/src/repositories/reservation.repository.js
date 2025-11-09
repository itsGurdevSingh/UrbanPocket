import mongoose from 'mongoose';
import ReserveStock from '../models/reserveStock.model.js';
import InventoryItem from '../models/inventory.model.js';
import { ApiError } from '../utils/errors.js';
import variantRepository from './variant.repository.js';
import logger from '../utils/logger.js';

class ReservationRepository {
    constructor() {
        this.model = ReserveStock;
    }

    async createReservation(data, externalsession) {

        const { variantId, quantity, batches, reservationId } = data;

        let session = externalsession;
        let shouldManageSession = false;

        if (!externalsession) {
            session = await mongoose.startSession();
            session.startTransaction();
            shouldManageSession = true;
        }

        try {
            const reservation = new this.model({
                variantId,
                totalQuantity: quantity,
                inventoryEntries: batches,
                reservationId
            });

            // Save with session
            const savedReservation = await reservation.save({ session });

            if (shouldManageSession) {
                await session.commitTransaction();
            }

            return savedReservation;
        } catch (error) {
            if (shouldManageSession && session.inTransaction()) {
                await session.abortTransaction();
            }
            throw error;
        } finally {
            if (shouldManageSession) {
                session.endSession();
            }
        }
    }

    async getReservationById(reservationId) {
        return await this.model.findById(reservationId);
    }

    async getReservationByOrderId(orderId) {
        return await this.model.findOne({ reservationId: orderId });
    }
}

export default new ReservationRepository();