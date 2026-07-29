/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_AWS_REGION: string
  readonly VITE_COGNITO_USER_POOL_ID: string
  readonly VITE_COGNITO_CLIENT_ID: string
  /** Comma-separated emails that see the Settings "Tester approval" tab (API enforces separately). */
  readonly VITE_PLATFORM_ADMIN_EMAILS?: string
  /** PostHog project key. Set in Vercel production only; absent locally disables analytics. */
  readonly VITE_POSTHOG_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * MDX marketing content (src/content/**). `meta` is the YAML frontmatter, surfaced as a named
 * export by remark-mdx-frontmatter — see vite.config.ts.
 */
declare module '*.mdx' {
  import type { ComponentType } from 'react'
  export const meta: import('@/features/content/registry').ContentMeta
  const MDXComponent: ComponentType<Record<string, unknown>>
  export default MDXComponent
}

