# The Brain

Panel visual local para orquestar agentes de IA por proyecto. Cada proyecto es una sala de una oficina isométrica alrededor de **The Brain**, la memoria compartida. Escribes en la barra de chat, un router decide a qué agente va la orden, y cada agente la descompone en tareas que puedes seguir en una cola. Todo lo que afecta a algo externo espera tu aprobación.

## Arrancar

```bash
git clone https://github.com/rnachoc/the-brain.git
cd the-brain
npm install
npm run dev
```

Abre http://localhost:5173.

La primera vez se crea **`config.json`** a partir de `config.example.json`. Ese archivo es **tuyo**: define ahí tus proyectos y agentes. Está en `.gitignore`, así que nunca se sube al repo.

## Tus agentes

Cada entrada de `projects` en `config.json` es un agente con su propia sala:

```json
{
  "id": "tienda",
  "name": "Mi Tienda Online",
  "aliases": ["tienda", "shop"],
  "color": "#22d3ee",
  "icon": "🛒",
  "agents": 1,
  "folder": "workspaces/tienda",
  "description": "Catálogo, pedidos y campañas.",
  "keywords": ["pedido", "producto", "catálogo", "envío"],
  "tools": ["Read", "Write", "Edit", "Glob", "Grep", "WebSearch"],
  "systemPrompt": "Eres el agente de la tienda online del usuario... Nunca envíes ni publiques nada: deja el borrador y pide aprobación."
}
```

| Campo | Para qué sirve |
| --- | --- |
| `aliases` | Lo que escribes con `@` en el chat para dirigir la orden (`@tienda`). |
| `keywords` | Pistas para el router cuando no mencionas el proyecto. |
| `color`, `icon` | Color de acento y emoji de la sala. |
| `agents` | Número de mesas que se dibujan en la sala. |
| `folder` | Carpeta de trabajo del agente. |
| `tools` | Herramientas que el agente puede usar. |
| `fallback: true` | Solo para el agente General, que recibe lo que no encaja en otro sitio. |

Al guardar, la sala aparece en el siguiente hueco libre alrededor de The Brain. Los datos de ejemplo también se generan a partir de tus proyectos.

## Estado

| Fase | Contenido | Estado |
| --- | --- | --- |
| a | UI isométrica con datos de ejemplo y motor simulado | ✅ |
| b | Backend, chat y enrutado con un agente real | ⏳ |
| c | Todos los agentes y Brain persistente | ⏳ |
| d | Tareas programadas y calendario | ⏳ |

En la fase **a**, el enrutado y los agentes están simulados en el navegador (`web/src/mock/`). Todavía no se llama a ningún modelo.

## Privacidad y seguridad

- **Lo personal no se sube nunca.** `config.json`, `brain/` (notas compartidas), `workspaces/` (lo que producen los agentes), `data/` (base de datos) y `.env` están en `.gitignore`.
- Los agentes **nunca** envían mensajes, emails, publicaciones ni pagos. Dejan un borrador con **Aprobar / Rechazar**, y aprobar solo lo deja listo para que lo envíes tú.
- No se borran archivos de forma permanente.
- Cada acción de cada agente queda registrada en el log.

## Estructura

```
config.example.json  plantilla de proyectos (se copia a config.json)
scripts/             utilidades (crear config.json la primera vez)
web/                 React + Vite + Tailwind
  src/office/        Office isométrica en SVG (salas, The Brain)
  src/components/    barra superior, chat, cola de órdenes, panel del agente
  src/views/         Tasks, Calendar, Brain
  src/mock/          router y motor simulados (fase a)
```
