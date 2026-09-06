import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: '/writing-studio/',
  plugins: [react(), VitePWA({ registerType: 'prompt', includeAssets: ['icon.svg','icon-180.png','icon-192.png','icon-512.png'], manifest: {
    name: '장편 원고 편집실', short_name: '원고 편집실', description: '브라우저에 보관하는 개인용 소설 편집실', lang: 'ko', start_url: './', scope: './', display: 'standalone', background_color: '#f5f7f9', theme_color: '#173d4c', icons: [{src:'./icon-192.png',sizes:'192x192',type:'image/png'},{src:'./icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]
  }, workbox: { globPatterns: ['**/*.{js,css,html,svg,webmanifest}'], cleanupOutdatedCaches: true, navigateFallback: 'index.html', navigateFallbackDenylist: [/^\/api\//] } })],
});
