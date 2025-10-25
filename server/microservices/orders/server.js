import app from './src/app.js';
import connectToDb from './src/db/db.js';
import getConfig from './src/config/config_keys.js';
import logger from './src/utils/logger.js';

const PORT = getConfig('port');

const startServer = async () => {
    try {
        // Connect to database
        await connectToDb();

        // Start server
        app.listen(PORT, () => {
            logger.info(`Order service is running on port ${PORT}`);
            logger.info(`Environment: ${getConfig('nodeEnv')}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', { error });
        process.exit(1);
    }
};

startServer();
