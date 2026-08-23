import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// `server-only` deliberately throws outside Next.js' server module graph.
// Vitest exercises route handlers directly, so replace only that import-time
// sentinel while leaving the production bundle protection intact.
vi.mock('server-only', () => ({}));
