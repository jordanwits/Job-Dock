/**
 * Load missing env vars from repo-root .env.local / .env before Prisma resolves DATABASE_URL.
 * Does not override keys already set in the process environment.
 */
import { existsSync, readFileSync } from 'fs'
import path from 'path'

function applyLine(line: string): void {
  const t = line.trim()
  if (!t || t.startsWith('#')) return
  const eq = t.indexOf('=')
  if (eq <= 0) return
  const key = t.slice(0, eq).trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return
  let val = t.slice(eq + 1).trim()
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1)
  }
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = val
  }
}

function loadFile(fp: string): void {
  if (!existsSync(fp)) return
  const text = readFileSync(fp, 'utf-8')
  for (const line of text.split(/\r?\n/)) {
    applyLine(line)
  }
}

const backendDir = path.resolve(process.cwd())
const repoRoot = path.resolve(backendDir, '..')
loadFile(path.join(repoRoot, '.env.local'))
loadFile(path.join(repoRoot, '.env'))
loadFile(path.join(backendDir, '.env'))
