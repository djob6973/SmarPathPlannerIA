# Plan: Roadmap Kanban Inteligente

## Stack
- TanStack Start + Lovable Cloud (DB, Auth, server functions)
- OpenAI directo (secreto `OPENAI_API_KEY`)
- Paleta: #333333 / #F1F1F1 / #D5D6D7 / acento #ED5650

## Modelo de datos (Cloud)
- `profiles` (id, full_name, email)
- `user_roles` (user_id, role) — enum `admin | manager | client | viewer` + función `has_role()`
- `kanban_columns` (id, name, position, color) — configurable por admin
- `custom_fields` (id, name, type, options jsonb, required) — configurable
- `requests` (id, title, description, status_column_id, created_by, assigned_to, priority, custom_data jsonb, created_at, updated_at)
- `chat_conversations` (id, request_id, user_id) y `chat_messages` (id, conversation_id, role, content)
- `ai_settings` (singleton: system_prompt, model, intake_questions jsonb) — editable por admin

RLS:
- Cliente: ve/edita solo sus `requests` y sus chats
- Manager: ve/edita todas las requests, mueve tarjetas
- Admin: todo + configuración (columnas, campos, prompt, roles)
- Viewer: solo SELECT en requests y analítica

## Páginas (rutas TanStack)
- `/login` — email+password
- `/_authenticated/` — layout con sidebar
  - `/chat/new` — chat con agente IA para crear solicitud
  - `/requests` — listado/tabla con filtros por estado, prioridad, asignado
  - `/board` — Kanban con drag-and-drop (@dnd-kit) por columna configurable
  - `/analytics` — dashboard: totales por estado, en curso, pendientes, completados, gráficos (Recharts)
  - `/settings/columns` — admin: CRUD columnas
  - `/settings/fields` — admin: CRUD campos personalizados
  - `/settings/ai` — admin: prompt + preguntas de intake + modelo
  - `/settings/users` — admin: invitar, asignar roles

## Agente IA (server function)
- `chatWithAgent` (createServerFn, requireSupabaseAuth)
  - Lee `ai_settings` (prompt + preguntas guía)
  - Envía historial a OpenAI Chat Completions con tool-calling
  - Tool `create_request` → cuando el agente recopiló info (objetivo, proceso, detalles), crea `requests` con `custom_data`
  - Devuelve respuesta + posible request creada

## Componentes clave
- `ChatPanel` — UI conversacional con streaming
- `KanbanBoard` + `KanbanColumn` + `RequestCard` (drag & drop)
- `RequestsTable` (Shadcn DataTable)
- `AnalyticsDashboard` (KPIs + 2-3 charts)
- `RoleGuard` — permisos por rol

## Diseño
- Tema claro por defecto, gris/coral, tipografía Inter, bordes suaves, acento coral en CTAs y estado activo
- Tokens semánticos en `src/styles.css`

## Pasos de ejecución
1. Habilitar Lovable Cloud + pedir `OPENAI_API_KEY`
2. Migración SQL: enums, tablas, RLS, función `has_role`, seeds (columnas default, ai_settings)
3. Diseño tokens en `styles.css`
4. Auth (login + signup + onAuthStateChange + `_authenticated` layout)
5. Server functions: requests CRUD, columnas, campos, ai_settings, users/roles, chat OpenAI
6. UI: sidebar + chat + tabla + kanban + analítica + settings
7. Sitemap/robots/llms.txt