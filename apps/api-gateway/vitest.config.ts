import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        testTimeout: 30000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.config.ts'],
            all: true,
            lines: 80,
            functions: 80,
            branches: 80,
            statements: 80,
        },
    },
});
