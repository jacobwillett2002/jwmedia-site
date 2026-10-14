// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://jwmedia.biz',
  adapter: cloudflare({
    // Resize and compress every photo once, when the site is built, and serve the results as
    // plain files from Cloudflare's cache. (The default resized photos on demand, on the first
    // visit from each region, which made photos slow to appear.)
    imageService: 'compile',
  }),

  // Fonts are served from jwmedia.biz itself (font files from the @fontsource packages) instead
  // of Google Fonts, so the page doesn't wait on a second server before showing text.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Bebas Neue',
      cssVariable: '--font-bebas',
      fallbacks: ['Oswald', 'sans-serif'],
      options: {
        variants: [
          { src: ['@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2'], weight: 400, style: 'normal' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          { src: ['@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'], weight: '100 900', style: 'normal' },
        ],
      },
    },
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [sitemap()]
});
