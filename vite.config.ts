import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'web-ifc': ['web-ifc'],
                    'three': ['three'],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
    },
});
