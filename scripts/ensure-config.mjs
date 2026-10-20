// Crea config.json a partir de config.example.json la primera vez.
// config.json es personal (está en .gitignore): cada uno define ahí sus agentes.
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'config.json')

if (!existsSync(target)) {
  copyFileSync(join(root, 'config.example.json'), target)
  console.log('✓ Creado config.json a partir de config.example.json. Edítalo para definir tus agentes.')
}
