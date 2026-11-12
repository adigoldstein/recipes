import { setupServer } from 'msw/node';

/**
 * A fake API for the component tests. Each test file adds its own handlers.
 */
export const server = setupServer();
