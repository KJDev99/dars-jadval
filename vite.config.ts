import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * BASE_PATH — ilova sayt ildizida emas, ichki papkada joylashsa kerak bo'ladi.
 * Masalan GitHub Pages uchun:  BASE_PATH=/dars-jadval/ npm run build
 * Manifest, ikonka va service worker havolalari nisbiy yozilgani uchun
 * boshqa hech narsani o'zgartirish shart emas.
 */
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { port: 5180, open: true },
  worker: { format: 'es' },
})
