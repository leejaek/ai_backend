import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

export const winstonConfig = (): WinstonModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    transports: [
      new winston.transports.Console({
        level: isProduction ? 'info' : 'debug',
        format: isProduction
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            )
          : winston.format.combine(
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              winston.format.colorize(),
              winston.format.printf(
                ({ timestamp, level, message, context, ...meta }) => {
                  return `${timestamp} [${context || 'Application'}] ${level}: ${message}${
                    Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
                  }`;
                },
              ),
            ),
      }),
    ],
  };
};
