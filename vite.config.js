import { resolve } from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { compression } from 'vite-plugin-compression2';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import autoprefixer from 'autoprefixer';
import mobileBackgrounds from './vite-plugin-mobile-backgrounds.js';
import htmlIncludes from './vite-plugin-html-includes.js';

/**
 * VITE CONFIG
 *
 * Base path управляется через переменную окружения VITE_BASE_URL:
 * - По умолчанию: '/'
 */

export default defineConfig(({ command, mode }) => {
  const base = process.env.VITE_BASE_URL || '/';

  return {
    base,

    server: {
      port: 3000,
      strictPort: true,
      open: true,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },

    preview: {
      port: 4173,
      open: true,
    },

    css: {
      devSourcemap: true,
      postcss: {
        plugins: [
          autoprefixer({
            flexbox: 'no-2009',
            grid: 'autoplace',
          }),
        ],
      },
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // Source maps only in dev — don't ship to production (leaks source code)
      sourcemap: mode !== 'production',
      
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_debugger: true,
          // Удаляем только debug-логи, сохраняем error/warn для диагностики в production
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
        },
        format: {
          comments: false,
        },
      },

      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks(id) {
            if (/js\/utils\/(CSSVariables|MediaQueryManager|EventEmitter|EventListenerManager|TimerManager|LRUCache|TransitionHelper|HTMLSanitizer|ErrorHandler|StorageManager)\.js/.test(id)) {
              return 'utils';
            }
            if (/js\/managers\/(BookStateMachine|SettingsManager|BackgroundManager|ContentLoader|AsyncPaginator)\.js/.test(id)) {
              return 'managers';
            }
            if (/js\/core\/delegates\/(NavigationDelegate|SettingsDelegate|FontController|AudioController|ThemeController|LifecycleDelegate|ChapterDelegate|DragDelegate|DragDOMPreparer)\.js/.test(id)) {
              return 'delegates';
            }
            if (/js\/(core\/AccountScreen|admin\/ServerAdminConfigStore|admin\/AdminConfigStore|admin\/modules\/ProfileModule)\.js/.test(id)) {
              return 'account';
            }
          },
          
          entryFileNames: 'assets/js/[name]-[hash].js',
          chunkFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (!assetInfo.name) {
              return 'assets/[name]-[hash][extname]';
            }
            
            const name = assetInfo.name;
            
            if (/\.(png|jpe?g|webp|svg|gif|tiff|bmp|ico)$/i.test(name)) {
              return 'assets/images/[name]-[hash][extname]';
            }
            
            if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            
            if (/\.css$/i.test(name)) {
              return 'assets/css/[name]-[hash][extname]';
            }
            
            return 'assets/[name]-[hash][extname]';
          },
        },
      },

      chunkSizeWarningLimit: 600,
      cssCodeSplit: true,
      cssMinify: true,
      copyPublicDir: true,
    },

    plugins: [
      // Сборка HTML из партиалов (<!--#include "..." -->)
      htmlIncludes(),

      // Генерация мобильных фоновых изображений (960px)
      mobileBackgrounds(),

      // PWA поддержка (Service Worker + Manifest)
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'icons/*.png',
          'sounds/**/*.mp3',
        ],
        workbox: {
          // SPA: все навигационные запросы → index.html (кроме /api/*)
          navigateFallback: 'index.html',
          navigateFallbackAllowlist: [/^(?!\/api\/).*/],
          // Предварительное кэширование статики
          globPatterns: [
            '**/*.{js,css,html,woff2}',
            'content/*.html',
          ],
          // Кэширование в рантайме для больших файлов
          runtimeCaching: [
            {
              urlPattern: /\.(?:png|jpg|jpeg|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 дней
                },
              },
            },
            {
              urlPattern: /\.(?:mp3|wav|ogg)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'audio-cache',
                expiration: {
                  maxEntries: 15,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 дней
                },
              },
            },
          ],
        },
        manifest: {
          name: 'Flipbook — Интерактивная читалка',
          short_name: 'Flipbook',
          description: 'Электронная книга с реалистичной 3D анимацией перелистывания страниц',
          theme_color: '#1a1a2e',
          background_color: '#1a1a2e',
          display: 'standalone',
          orientation: 'any',
          start_url: '.',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),

      // Gzip + Brotli сжатие
      compression({
        threshold: 10240,
        algorithm: 'gzip',
        exclude: [/\.(br|gz)$/],
      }),
      compression({
        threshold: 10240,
        algorithm: 'brotliCompress',
        exclude: [/\.(br|gz)$/],
      }),

      // Оптимизация изображений (Sharp + SVGO)
      ViteImageOptimizer({
        png: {
          quality: 80,
          compressionLevel: 7,
        },
        jpeg: {
          quality: 85,
          mozjpeg: true,
        },
        gif: {
          effort: 7,
        },
        webp: {
          quality: 85,
        },
        svg: {
          plugins: [
            {
              name: 'removeViewBox',
              active: false,
            },
            {
              name: 'removeEmptyAttrs',
              active: true,
            },
          ],
        },
      }),
    ],

    resolve: {
      alias: {
        '@': '/js',
        '@utils': '/js/utils',
        '@managers': '/js/managers',
        '@core': '/js/core',
        '@i18n': '/js/i18n',
        '@shared': '/shared',
        '@css': '/css',
        '@images': '/images',
        '@fonts': '/fonts',
      },
    },
  };
});