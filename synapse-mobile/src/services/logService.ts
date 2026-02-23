/**
 * Log Service
 * Centralized logging utility
 */

import {LogEntry} from '@types/index';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class LogService {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private currentLevel: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any,
  ): void {
    const levelEnum = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
    if (levelEnum < this.currentLevel) return;

    const entry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      level,
      message,
      source: 'app',
      metadata: data,
    };

    this.logs.unshift(entry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Console output
    const consoleMessage = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`;
    switch (level) {
      case 'debug':
        console.debug(consoleMessage, data || '');
        break;
      case 'info':
        console.info(consoleMessage, data || '');
        break;
      case 'warn':
        console.warn(consoleMessage, data || '');
        break;
      case 'error':
        console.error(consoleMessage, data || '');
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  getLogs(
    filter?: {level?: string; source?: string},
    limit: number = 100,
  ): LogEntry[] {
    let filtered = this.logs;

    if (filter?.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }

    if (filter?.source) {
      filtered = filtered.filter(log => log.source === filter.source);
    }

    return filtered.slice(0, limit);
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.currentLevel = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logService = new LogService();
