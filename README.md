# The Brain

Panel visual local para orquestar agentes de IA por proyecto. Cada proyecto es una sala de una oficina isométrica alrededor de **The Brain**, la memoria compartida. Escribes en la barra de chat, un router decide a qué agente va la orden, y cada agente la descompone en tareas que puedes seguir en una cola. Todo lo que afecta a algo externo espera tu aprobación.

## Arrancar

```bash
git clone https://github.com/rnachoc/the-brain.git
cd the-brain
npm install
npm run dev
```

Abre http://localhost:5173. `npm run dev` arranca a la vez el servidor de agentes (`:8787`) y la web (`:5173`).

La primera vez se crea **`config.json`** a partir de `config.example.json`. Ese archivo es **tuyo**: define ahí tus proyectos y agentes. Está en `.gitignore`, así que nunca se sube al repo.

### Conectar Claude

Sin configurar nada, The Brain funciona en **modo simulado**: el router enruta por palabras clave y los agentes hacen una demo sin llamar a ningún modelo. Para usar Claude:

```bash
cp .env.example .env
```

Pon tu `ANTHROPIC_API_KEY` en `.env` (sácala de https://console.anthropic.com) y reinicia `npm run dev`. Con la clave:

- El **router** usa Claude Haiku 5.5 (`routerModel`) para decidir a qué proyecto va cada mensaje y, si afecta a varios, reparte la petición entre ellos.
- Los proyectos con **`"live": true`** en `config.json` usan un agente real del **Claude Agent SDK** con el modelo `model` (por defecto Claude Sonnet 5.5). Los demás siguen simulados hasta la fase c.

Cada run real muestra su resultado y su coste en el historial del agente.

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
| `live: true` | Usa el agente real de Claude (necesita API key). |
| `model` | Modelo de este agente; si no se pone, el de `defaults.model`. |

Al guardar, la sala aparece en el siguiente hueco libre alrededor de The Brain. Los datos de ejemplo también se generan a partir de tus proyectos.

## Estado

| Fase | Contenido | Estado |
| --- | --- | --- |
| a | UI isométrica con datos de ejemplo | ✅ |
| b | Backend, chat y enrutado con un agente real | ✅ |
| c | Todos los agentes y Brain persistente | ⏳ |
| d | Tareas programadas y calendario | ⏳ |

Hasta las fases **c** y **d**, las notas del Brain y las tareas programadas son datos de ejemplo en el navegador (`web/src/mock/seed.ts`).

## Cómo funciona un mensaje

1. Escribes en el chat. Si mencionas `@proyecto`, se respeta. Si no, el router decide; si no lo tiene claro, te pregunta.
2. Cada agente elegido arranca en paralelo y publica su plan (2-6 órdenes) en la cola con la herramienta `plan_orders`.
3. Marca cada orden según avanza (`update_order`). Para todo lo externo deja el borrador y llama a `request_approval`, que **pausa** el agente hasta que pulses Aprobar o Rechazar.
4. Todo queda en SQLite (`data/the-brain.db`): mensajes, runs, órdenes y un log con cada herramienta que usa cada agente.

## Privacidad y seguridad

- **Lo personal no se sube nunca.** `config.json`, `brain/` (notas compartidas), `workspaces/` (lo que producen los agentes), `data/` (base de datos) y `.env` están en `.gitignore`.
- Los agentes **nunca** envían mensajes, emails, publicaciones ni pagos. Dejan un borrador con **Aprobar / Rechazar**, y aprobar solo lo deja listo para que lo envíes tú.
- Cada agente solo escribe en su carpeta (`folder`) y solo lee esa carpeta y `/brain`. Los comandos que borran o envían cosas (`rm`, `del`, `git push`, `curl`…) se bloquean.
- Cada agente solo tiene las herramientas de su `tools`, sin tus ajustes ni tu `CLAUDE.md`.
- Cada acción de cada agente queda registrada en el log, incluidas las bloqueadas.

## Estructura

```
config.example.json  plantilla de proyectos (se copia a config.json)
.env.example         plantilla de claves (se copia a .env)
shared/              tipos compartidos entre servidor y web
server/              Node + Fastify + WebSocket + SQLite
  src/router.ts      @menciones, router con Claude o palabras clave
  src/orchestrator.ts  lanza los agentes en paralelo
  src/agents/        agente real (Agent SDK), herramientas MCP, guardas, simulado
web/                 React + Vite + Tailwind
  src/office/        Office isométrica en SVG (salas, The Brain)
  src/components/    barra superior, chat, cola de órdenes, panel del agente
  src/views/         Tasks, Calendar, Brain
```
