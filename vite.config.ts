import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
    plugins: [react(), viteSingleFile()],
    build: {
        rollupOptions: {
            input: process.env.INPUT,
        },
        outDir: "dist", // Output to dist directory
        emptyOutDir: false, // Don't delete existing files in dist.
    }
})