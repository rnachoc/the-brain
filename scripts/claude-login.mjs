// Genera un token de tu suscripción de Claude (Pro/Max) para que The Brain use tu plan
// en local, sin API key. Usa el Claude Code que ya trae el Agent SDK.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(join(process.cwd(), 'server', 'package.json'))
const pkg = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`
let bin
try {
  bin = join(dirname(require.resolve(`${pkg}/package.json`)), process.platform === 'win32' ? 'claude.exe' : 'claude')
} catch {
  console.error(`No encuentro ${pkg}. Ejecuta primero: npm install`)
  process.exit(1)
}

console.log('Se abrirá el navegador para iniciar sesión con tu cuenta de Claude.')
console.log('Al terminar verás un token: cópialo en .env como CLAUDE_CODE_OAUTH_TOKEN=...\n')
const res = spawnSync(bin, ['setup-token'], { stdio: 'inherit' })
process.exit(res.status ?? 1)
