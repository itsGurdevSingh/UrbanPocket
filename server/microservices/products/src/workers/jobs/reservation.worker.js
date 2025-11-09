import ReserveStock from '../../models/reserveStock.model.js';
import Inventory from '../../models/inventory.model.js';
import { logger } from '../../utils/logger.js';
import reservationService from '../../services/reservation.service.js';

/**
 * Finds and processes all expired stock reservations.
 */
export const handleExpiredReservations = async () => {
  logger.info('Running reservation janitor job...');
  const now = new Date();

  // 1. Find all expired reservations that are still PENDING
  const expiredReservations = await ReserveStock.find({
    status: 'PENDING',
    expiresAt: { $lt: now },
  });

  if (expiredReservations.length === 0) {
    logger.info('No expired reservations found.');
    return;
  }

  // 2. Process each one
  for (const reservation of expiredReservations) {
    logger.warn(`Reservation ${reservation._id} expired at ${reservation.expiresAt}. Releasing stock.`);
    
    try {
      // Release the reserved stock back to inventory      
      await reservationService.releaseReservedStock({ reserveId: reservation._id });

      logger.info(`Stock released and reservation ${reservation._id} deleted.`);
      
    } catch (error) {
      logger.error(`Failed to process expired reservation ${reservation._id}:`, error);
      // We don't delete it, so the job will try again on the next run
    }
  }
};