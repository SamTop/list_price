const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.File({ filename: 'error.txt', level: 'error' }),
        new winston.transports.File({ filename: 'log.txt', level: 'info' }),
    ],
});

module.exports = logger;
