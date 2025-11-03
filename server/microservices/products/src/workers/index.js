import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { schedules } from '../config/cron.config.js';
import { handleExpiredReservations } from './jobs/reservation.worker.js';

/**
 * An array to hold all running cron job instances.
 * This allows us to stop them gracefully.
 * @type {Array<{name: string, instance: cron.ScheduledTask}>}
 */
const runningJobs = [];

/**
 * Initializes and starts all scheduled background workers for the service.
 */
export const startWorkers = () => {
    logger.info('Initializing background workers...');

    const jobs = [
        {
            name: 'Reservation Janitor',
            schedule: schedules.RESERVATION_JANITOR,
            task: handleExpiredReservations,
        },
        // ... Add future jobs here
    ];

    jobs.forEach((job) => {
        if (cron.validate(job.schedule)) {
            // 1. Create the job
            const jobInstance = cron.schedule(job.schedule, async () => {
                try {
                    logger.info(`Running job: ${job.name}`);
                    await job.task();
                    logger.info(`Finished job: ${job.name}`);
                } catch (error) {
                    logger.error(`Error running job ${job.name}:`, error);
                }
            });

            // 2. Store its reference
            runningJobs.push({ name: job.name, instance: jobInstance });

            logger.info(`Scheduled job: ${job.name} (${job.schedule})`);
        } else {
            logger.error(`Invalid cron schedule for ${job.name}: ${job.schedule}`);
        }
    });
};

/**
 * Stops all running background workers.
 * This is called during a graceful shutdown.
 */
export const stopWorkers = () => {
    logger.info('Stopping all background workers...');

    // 3. Iterate and stop each job
    runningJobs.forEach((job) => {
        job.instance.stop(); // This stops the job from running again
        logger.info(`Stopped job: ${job.name}`);
    });
};