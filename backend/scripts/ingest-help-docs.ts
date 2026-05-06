/**
 * Ingest markdown from help-knowledge/ into Postgres (pgvector) for the help chatbot.
 * Requires: DATABASE_URL, OPENAI_API_KEY, pgvector extension enabled on the database.
 *
 * Usage from repo root: cd backend && npx tsx scripts/ingest-help-docs.ts
 * Or: npm run ingest-help (from backend/)
 */

import './bootstrapLocalEnv'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
import prisma from '../src/lib/db'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const CHUNK_SIZE = 1800
const CHUNK_OVERLAP = 200

function chunkText(text: string, size: number, overlap: number): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []
  const chunks: string[] = []
  let start = 0
  while (start < cleaned.length) {
    const end = Math.min(start + size, cleaned.length)
    chunks.push(cleaned.slice(start, end))
    if (end >= cleaned.length) break
    start = end - overlap
    if (start < 0) start = 0
  }
  return chunks
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...(await collectMarkdownFiles(p)))
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(p)
    }
  }
  return out
}

async function main() {
  const root = path.resolve(process.cwd(), '../help-knowledge')
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey?.trim()) {
    console.error('OPENAI_API_KEY is required')
    process.exit(1)
  }

  let stat
  try {
    stat = await fs.stat(root)
  } catch {
    console.error(`Missing knowledge directory: ${root}`)
    process.exit(1)
  }
  if (!stat.isDirectory()) {
    console.error(`Not a directory: ${root}`)
    process.exit(1)
  }

  const openai = new OpenAI({ apiKey: openaiKey })
  const files = await collectMarkdownFiles(root)
  if (files.length === 0) {
    console.warn('No .md files found; nothing to ingest.')
    return
  }

  for (const filePath of files) {
    const source = path.relative(root, filePath).replace(/\\/g, '/')
    const body = await fs.readFile(filePath, 'utf-8')
    const parts = chunkText(body, CHUNK_SIZE, CHUNK_OVERLAP)
    console.log(`Processing ${source}: ${parts.length} chunks`)

    await prisma.$executeRawUnsafe(`DELETE FROM help_knowledge_chunks WHERE source = $1`, source)

    for (let i = 0; i < parts.length; i += 16) {
      const batch = parts.slice(i, i + 16)
      const emb = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      })
      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = i + j
        const content = batch[j]!
        const vector = emb.data[j]?.embedding
        if (!vector) throw new Error(`Missing embedding for chunk ${chunkIndex}`)
        const vecStr = `[${vector.join(',')}]`
        const id = randomUUID()
        await prisma.$executeRawUnsafe(
          `INSERT INTO help_knowledge_chunks (id, source, chunk_index, content, metadata, embedding, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector, NOW(), NOW())`,
          id,
          source,
          chunkIndex,
          content,
          JSON.stringify({ path: source }),
          vecStr
        )
      }
    }
  }

  console.log('Ingest complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
