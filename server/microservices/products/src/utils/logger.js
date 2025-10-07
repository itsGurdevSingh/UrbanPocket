import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const myFormat = printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
});

// Decide logging verbosity. In test environment we drastically reduce noise.
const isTest = process.env.NODE_ENV === 'test';
const level = isTest ? (process.env.TEST_LOG_LEVEL || 'error') : (process.env.LOG_LEVEL || 'info');

// In test mode we use a simplified format without colors to keep output compact.
const consoleFormat = isTest
    ? combine(timestamp(), printf(({ level, message }) => `${level}: ${message}`))
    : combine(colorize(), timestamp(), myFormat);

const transports = [];
// If user wants completely silent tests they can export TEST_LOG_LEVEL=silent
if (!(isTest && level === 'silent')) {
    transports.push(new winston.transports.Console({ format: consoleFormat, level }));
}

const logger = winston.createLogger({
    level,
    format: combine(timestamp(), myFormat),
    transports,
    silent: isTest && level === 'silent'
});

export default logger;