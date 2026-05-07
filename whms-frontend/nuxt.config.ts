import { defineNuxtConfig } from 'nuxt/config'
import Aura from '@primeuix/themes/aura'

export default defineNuxtConfig({
  devtools: { enabled: true },
  typescript: { strict: true },

  app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://cdn.jsdelivr.net/npm/primeicons@7.0.0/primeicons.css'
        }
      ]
    }
  },

  modules: [
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/tailwindcss',
    '@vite-pwa/nuxt',
    'nuxt-lodash',
    '@primevue/nuxt-module'
  ],

  primevue: {
    options: {
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
          cssLayer: true
        }
      }
    }
  },

  pinia: { 
    storesDirs: ['./stores/**'] 
  },

  vueuse: { ssrHandlers: true },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'WHMS — Warehouse Management System',
      short_name: 'WHMS',
      description: 'Sistem Manajemen Gudang modern untuk perusahaan distribusi Indonesia',
      theme_color: '#1F4E79',
      background_color: '#F8FAFC',
      display: 'standalone',
      orientation: 'any',
      start_url: '/dashboard',
      scope: '/',
      lang: 'id',
      categories: ['business', 'productivity'],
      icons: [
        { src: '/icons/icon-72.svg', sizes: '72x72', type: 'image/svg+xml' },
        { src: '/icons/icon-96.svg', sizes: '96x96', type: 'image/svg+xml' },
        { src: '/icons/icon-128.svg', sizes: '128x128', type: 'image/svg+xml' },
        { src: '/icons/icon-144.svg', sizes: '144x144', type: 'image/svg+xml' },
        { src: '/icons/icon-152.svg', sizes: '152x152', type: 'image/svg+xml' },
        { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' as any },
        { src: '/icons/icon-384.svg', sizes: '384x384', type: 'image/svg+xml' },
        { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' as any },
      ],
      shortcuts: [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Point of Sale', url: '/pos' },
        { name: 'Inventory', url: '/inventory/summary' },
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      runtimeCaching: [
        // API calls — Network First with 5s timeout
        { 
          urlPattern: /\/api\/.*/, 
          handler: 'NetworkFirst',
          options: { 
            cacheName: 'api-cache', 
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }
          } 
        },
        // Google Fonts stylesheets — Stale While Revalidate
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'google-fonts-stylesheets'
          }
        },
        // Google Fonts webfonts — Cache First
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-webfonts',
            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
          }
        },
        // Static image assets — Cache First
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images-cache',
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
          }
        }
      ]
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      enabled: false // Disable PWA in dev mode to avoid caching issues
    }
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE_URL || 'http://localhost:4000',
      wsUrl:   process.env.WS_URL || 'http://localhost:4000',
    }
  },

  imports: {
    dirs: ['stores', 'composables', 'services']
  },

  components: [
    { path: '~/components/ui', prefix: 'Ui' },
    { path: '~/components/app', prefix: 'App' },
    { path: '~/components/forms', prefix: 'Form' },
    { path: '~/components/charts', prefix: 'Chart' },
    { path: '~/components/pos', prefix: 'Pos' },
  ],

  css: ['~/assets/css/main.css'],

  ssr: false, // SPA mode — semua render di client
})
