import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { viteSingleFile } from 'vite-plugin-singlefile'

// One self-contained dist/index.html: JS and CSS are inlined, nothing is fetched at run time.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
