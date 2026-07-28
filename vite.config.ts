import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Marketing content (src/content/**) is authored in MDX. The plugin must run before
    // @vitejs/plugin-react — hence enforce: 'pre' — so React sees compiled JSX, not markdown.
    // remark-gfm is required for tables: they are a GitHub-Flavored Markdown extension, not
    // core CommonMark, so without it every comparison table renders as pipe-delimited text.
    // YAML frontmatter is exposed to importers as a named `meta` export.
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [
          remarkGfm,
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: 'meta' }],
        ],
      }),
    },
    react({ include: /\.(mdx|jsx|js|tsx|ts)$/ }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Only split React/vendor - keep axios, date-fns, zod in main bundle
        // to avoid Rollup traceVariable errors across chunk boundaries (zod + @hookform/resolvers)
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor'
          }
        },
      },
    },
  },
})

