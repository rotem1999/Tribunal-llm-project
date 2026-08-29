/**
 * Global test setup. NestJS decorators emit metadata via the reflect-metadata
 * polyfill, so it must be loaded before any decorated class is imported.
 */
import 'reflect-metadata';
