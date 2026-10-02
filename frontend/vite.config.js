import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      strategies: "generateSW",

      // La registrazione viene gestita dal componente React dedicato.
      injectRegister: null,

      // L'utente sceglie quando applicare una nuova versione.
      registerType: "prompt",

      includeAssets: [
        "favicon-64x64.png",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "pwa-maskable-512x512.png",
      ],

      manifest: {
        id: "/",
        name: "Office Clocking Demo",
        short_name: "Clocking Demo",
        description:
          "Versione dimostrativa di Office Clocking per la gestione di timbrature, presenze e assenze.",

        lang: "it-IT",

        start_url: "/",
        scope: "/",

        display: "standalone",
        orientation: "any",

        theme_color: "#f97316",
        background_color: "#fff7ed",

        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,

        // Asset statici prodotti dalla build Vite.
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webp,woff,woff2}",
        ],

        // Fallback necessario per le route gestite da React Router.
        navigateFallback: "/index.html",

        // Le navigazioni API non devono ricevere l'HTML dell'app.
        navigateFallbackDenylist: [/^\/api\//],

        // Le richieste API GET restano sempre dipendenti dalla rete.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            method: "GET",
          },
        ],
      },

      // Il service worker resta disattivato durante `npm run dev`.
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
