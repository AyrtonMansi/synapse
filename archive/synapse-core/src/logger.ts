/**
 * Structured Logging Utility
 * 
 * @module synapse-core/logger
 * @description Type-safe logging with structured output
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
  SILENT = 5,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  levelName: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /**
   * Minimum log level to output
   * @default LogLevel.INFO
   */
  level: LogLevel;
  
  /**
   * Logger name/prefix
   */
  name?: string;
  
  /**
   * Whether to include timestamps
   * @default true
   */
  timestamps: boolean;
  
  /**
   * Whether to output structured JSON
   * @default false
   */
  json: boolean;
  
  /**
   * Custom transport function
   */
  transport?: (entry: LogEntry) => void;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  fatal(message: string, error?: Error, context?: Record<string, unknown>): void;
  child(name: string): Logger;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  timestamps: true,
  json: false,
};

/**
 * Log level names
 */
const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
  [LogLevel.SILENT]: 'SILENT',
};

/**
 * ANSI color codes for console output
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: COLORS.cyan,
  [LogLevel.INFO]: COLORS.blue,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
  [LogLevel.FATAL]: COLORS.magenta,
  [LogLevel.SILENT]: COLORS.reset,
};

/**
 * Create a configured logger instance
 * 
 * @param config - Logger configuration
 * @returns Logger instance
 * 
 * @example
 * ```typescript
 * const logger = createLogger({ 
 *   name: 'MyService',
 *   level: LogLevel.DEBUG,
 *   json: process.env.NODE_ENV === 'production'
 * });
 * 
 * logger.info('Service started', { port: 3000 });
 * logger.error('Database connection failed', error);
 * ```
 */
export function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  const fullConfig: LoggerConfig = { ...DEFAULT_CONFIG, ...config };
  
  const shouldLog = (level: LogLevel): boolean => level >= fullConfig.level;
  
  const formatTimestamp = (): string => {
    if (!fullConfig.timestamps) return '';
    return new Date().toISOString();
  };
  
  const formatMessage = (entry: LogEntry): string => {
    if (fullConfig.json) {
      return JSON.stringify({
        timestamp: entry.timestamp,
        level: entry.levelName,
        name: fullConfig.name,
        message: entry.message,
        ...entry.context,
        ...(entry.error && {
          error: {
            message: entry.error.message,
            stack: entry.error.stack,
            name: entry.error.name,
          },
        }),
      });
    }
    
    const parts: string[] = [];
    
    if (fullConfig.timestamps) {
      parts.push(`${COLORS.dim}${entry.timestamp}${COLORS.reset}`);
    }
    
    parts.push(`${LEVEL_COLORS[entry.level]}[${entry.levelName}]${COLORS.reset}`);
    
    if (fullConfig.name) {
      parts.push(`[${fullConfig.name}]`);
    }
    
    parts.push(entry.message);
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(COLORS.dim + JSON.stringify(entry.context) + COLORS.reset);
    }
    
    if (entry.error) {
      parts.push(`\n${COLORS.red}${entry.error.stack}${COLORS.reset}`);
    }
    
    return parts.join(' ');
  };
  
  const log = (level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void => {
    if (!shouldLog(level)) return;
    
    const entry: LogEntry = {
      level,
      levelName: LEVEL_NAMES[level],
      message,
      timestamp: formatTimestamp(),
      context,
      error,
    };
    
    if (fullConfig.transport) {
      fullConfig.transport(entry);
    } else {
      const output = formatMessage(entry);
      
      if (level >= LogLevel.ERROR) {
        console.error(output);
      } else if (level === LogLevel.WARN) {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  };
  
  const logger: Logger = {
    debug: (message, context) => log(LogLevel.DEBUG, message, context),
    info: (message, context) => log(LogLevel.INFO, message, context),
    warn: (message, context) => log(LogLevel.WARN, message, context),
    error: (message, error, context) => log(LogLevel.ERROR, message, context, error),
    fatal: (message, error, context) => log(LogLevel.FATAL, message, context, error),
    child: (name) => createLogger({
      ...fullConfig,
      name: fullConfig.name ? `${fullConfig.name}:${name}` : name,
    }),
  };
  
  return logger;
}

/**
 * Global logger instance
 */
export const logger = createLogger();
