import { setupServer } from 'msw/node';

/** The API stand-in for component tests; each spec adds its own handlers. */
export const server = setupServer();
