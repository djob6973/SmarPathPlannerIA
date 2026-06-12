# SmartPath Planner — Documentación del Proyecto

## Propósito

SmartPath Planner es una plataforma SaaS de gestión de solicitudes/proyectos con agente IA conversacional. El flujo central es: el usuario conversa con un bot (GPT-4o-mini), el bot extrae la información clave mediante tool-calling y crea automáticamente una solicitud estructurada que aparece en el tablero Kanban.

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Meta-framework | TanStack Start (SSR/fullstack sobre Vite) |
| Runtime servidor | Nitro (Node.js preset) |
| Router | TanStack Router v1 (file-based, type-safe) |
| UI | React 18 + Radix UI + shadcn/ui |
| Estilos | Tailwind CSS v4 |
| Forms | React Hook Form v7 + Zod v3 |
| Drag & drop | @dnd-kit (core + sortable) |
| Charts | Recharts v3 |
| Estado servidor | TanStack React Query v5 |
| Base de datos | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth (email/password) |
| IA | OpenAI API — `gpt-4o-mini` con tool-calling |
| Idioma UI | Español (es locale) |

---

## Variables de Entorno Requeridas

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # operaciones admin sin RLS
OPENAI_API_KEY=                # agente de chat IA
```

---

## Estructura de Carpetas

```
src/
├── routes/                   # Páginas (file-based routing TanStack)
│   ├── __root.tsx            # Layout raíz con providers
│   ├── index.tsx             # Landing page (pública)
│   ├── login.tsx             # Signin / signup
│   ├── assign-super-admin.tsx # Setup inicial (primer super admin)
│   └── app/                  # Rutas protegidas (requieren auth)
│       ├── dashboard.tsx
│       ├── board.tsx
│       ├── requests.tsx
│       ├── chat.tsx
│       ├── analytics.tsx
│       ├── team.tsx
│       └── settings.tsx
├── components/
│   ├── ui/                   # Componentes shadcn/Radix reutilizables
│   ├── layout/               # AppSidebar
│   ├── requests/             # RequestDetailModal, ManualRequestModal
│   ├── admin/                # PermissionsManager, AreasManager
│   └── notifications/        # NotificationPanel
├── lib/
│   ├── auth-context.tsx      # AuthContext — user, roles, permisos, área
│   ├── auth-middleware.ts    # Middleware para createServerFn
│   ├── permissions.types.ts  # AppRole, AppPermission (tipos canónicos)
│   ├── permissions.functions.ts # CRUD de permisos por rol
│   ├── admin.functions.ts    # CRUD usuarios, roles, áreas (server fns)
│   ├── chat.functions.ts     # sendChatMessage — OpenAI + tool-calling
│   └── theme-context.tsx     # Tema dark/light/system
├── integrations/supabase/
│   ├── client.ts             # Cliente Supabase (lazy, via Proxy)
│   ├── client.server.ts      # Cliente admin con service_role
│   └── types.ts              # Tipos DB generados por Supabase
└── hooks/
    └── use-mobile.tsx
```

---

## Modelos de Datos

### Tablas principales

**`areas`** — Áreas organizacionales (multi-tenant)
- `id`, `name` (unique), `description`, `created_at`, `updated_at`

**`profiles`** — Perfil de usuario (1:1 con auth.users)
- `id` (UUID, FK auth.users), `full_name`, `email`, `avatar_url`
- `area_id` (FK areas, NULL para super_admin)

**`requests`** — Solicitudes (entidad principal)
- `id`, `title`, `description`, `objective`, `process`
- `priority`: `'low' | 'medium' | 'high' | 'urgent'`
- `status_column_id` (FK kanban_columns)
- `created_by`, `assigned_to` (FK profiles)
- `area_id` (FK areas)
- `position` (orden dentro de columna)
- `expires_at` (opcional)
- `custom_data` (JSON extensible)
- `created_at`, `updated_at`

**`kanban_columns`** — Columnas del tablero
- `id`, `name`, `position`, `color`
- `is_completed` (boolean — si marcar solicitudes como completadas)
- `area_id`

**`user_roles_smart_path`** — Asignación rol-usuario
- `id`, `user_id` (FK profiles), `role` (AppRole enum), `area_id`

**`role_permissions`** — Matriz rol × permiso
- `id`, `role`, `permission`, `enabled`

**`chat_conversations`** — Sesiones de chat IA
- `id`, `user_id`, `request_id` (FK requests, nullable), `title`

**`chat_messages`** — Mensajes de conversación
- `id`, `conversation_id`, `role` (`'user' | 'assistant'`), `content`

**`comments`** — Comentarios en solicitudes
- `id`, `request_id`, `user_id`, `content`, `created_at`, `updated_at`

**`notifications`** — Notificaciones de usuario
- `id`, `user_id`, `type`, `title`, `message`, `read`, `created_at`

**`ai_settings`** — Configuración IA por área
- `id`, `system_prompt`, `intake_questions` (JSON array), `model`, `is_active`, `area_id`

---

## Tipos TypeScript Canónicos

```typescript
// src/lib/permissions.types.ts
type AppRole =
  | "super_admin"
  | "area_admin"
  | "manager"
  | "client"
  | "viewer"

type AppPermission =
  | "create_requests"
  | "edit_own_requests"
  | "edit_all_requests"
  | "delete_own_requests"
  | "delete_all_requests"
  | "view_all_requests"
  | "assign_requests"
  | "manage_users"
  | "manage_roles"
  | "manage_permissions"
  | "view_analytics"
  | "export_data"
  | "use_ai_features"
  | "manage_settings"
  | "manage_request_expiration"
  | "manage_areas"
```

### AuthContext (src/lib/auth-context.tsx)

```typescript
interface AuthState {
  user: User | null
  session: Session | null
  profile: { full_name, email, area_id } | null
  roles: AppRole[]
  permissions: AppPermission[]
  areaId: string | null
  areaName: string | null
  isSuperAdmin: boolean   // ← usar ESTO para verificar admin
  isAreaAdmin: boolean    // ← usar ESTO para verificar area admin
  hasRole(role: AppRole): boolean
  hasPermission(perm: AppPermission): boolean
}
```

---

## Lógica de Auth y Roles

### Jerarquía de roles

| Rol | Acceso |
|-----|--------|
| `super_admin` | Global — todas las áreas, todos los permisos |
| `area_admin` | Su área — gestiona usuarios y configuración del área |
| `manager` | CRUD completo de solicitudes en su área + analytics |
| `client` | Crear/editar/eliminar sus propias solicitudes + IA |
| `viewer` | Solo lectura |

### Regla crítica sobre roles
**NUNCA usar `hasRole("admin")`** — el string `"admin"` no existe en `AppRole` y siempre retorna `false`. Para verificar administradores usar `isSuperAdmin` o `isAreaAdmin` del contexto.

### Permisos por defecto

| Permiso | super_admin | area_admin | manager | client | viewer |
|---------|:-----------:|:----------:|:-------:|:------:|:------:|
| create_requests | ✓ | ✓ | ✓ | ✓ | |
| edit_own_requests | ✓ | ✓ | ✓ | ✓ | |
| edit_all_requests | ✓ | ✓ | ✓ | | |
| delete_own_requests | ✓ | ✓ | ✓ | ✓ | |
| delete_all_requests | ✓ | ✓ | ✓ | | |
| view_all_requests | ✓ | ✓ | ✓ | ✓ | ✓ |
| assign_requests | ✓ | ✓ | ✓ | | |
| manage_users | ✓ | ✓ | | | |
| manage_roles | ✓ | ✓ | | | |
| manage_permissions | ✓ | | | | |
| view_analytics | ✓ | ✓ | ✓ | | |
| export_data | ✓ | ✓ | | | |
| use_ai_features | ✓ | ✓ | ✓ | ✓ | |
| manage_settings | ✓ | | | | |
| manage_request_expiration | ✓ | ✓ | ✓ | | |
| manage_areas | ✓ | | | | |

### Multi-área (tenancy)
- Cada tabla tiene `area_id` para aislar datos por área.
- RLS en Supabase filtra automáticamente por área del usuario.
- Super admin ve y puede cambiar a cualquier área desde el UI.

---

## Funcionalidades por Página

### `/` — Landing
Página pública con preview del UI, lista de features y CTA de registro.

### `/login` — Autenticación
Formulario signin/signup con Supabase Auth. Redirige a `/app/dashboard` al autenticarse.

### `/assign-super-admin` — Setup inicial
Asigna el primer super_admin. Usado una sola vez al inicializar la plataforma.

### `/app/dashboard` — Panel principal
- KPIs: total, en progreso, pendientes, completadas, alertas urgentes.
- Lista de solicitudes recientes con badges de estado y prioridad.
- Gráfico de distribución por estado (barra).
- Cards de acceso rápido a Chat, Tablero y Analytics.
- Filtro por área (solo super_admin).

### `/app/board` — Tablero Kanban
- Columnas configurables (nombre, color, posición, flag `is_completed`).
- Drag & drop de tarjetas entre columnas (@dnd-kit).
- Drag & drop solo habilitado con permiso `edit_all_requests` o `edit_own_requests` (verificado con `isSuperAdmin`/`isAreaAdmin`, no `hasRole("admin")`).
- Realtime updates via Supabase.
- Click en tarjeta abre `RequestDetailModal`.

### `/app/requests` — Lista de solicitudes
- Búsqueda por texto, filtro por prioridad y estado.
- Creación manual de solicitudes (`ManualRequestModal`).
- Modal de detalle con edición completa, comentarios, asignación y fecha de vencimiento.
- Eliminación masiva (con verificación de permisos).

### `/app/chat` — Agente IA
- Chat conversacional con GPT-4o-mini.
- El agente usa system_prompt + intake_questions configurados por área.
- Cuando recopila suficiente info, llama a la tool `create_request` y genera la solicitud automáticamente.
- Super admin puede seleccionar área destino; usuarios normales usan su área asignada.
- Historial de conversaciones en DB (`chat_conversations` + `chat_messages`).

### `/app/analytics` — Analítica
- Distribución por estado (gráfico de barras).
- Desglose por prioridad (gráfico de torta).
- Solicitudes completadas en el tiempo (línea/área, por semana/mes/trimestre).
- Selector de año, tasa de completado.

### `/app/team` — Equipo
- Lista de usuarios con roles y área asignada.
- Asignación/cambio de roles.
- Asignación de usuarios a áreas.

### `/app/settings` — Configuración (solo super_admin)
Pestañas:
- **Columnas:** Crear, editar, reordenar y eliminar columnas Kanban.
- **Agente IA:** Editar system_prompt, intake_questions y modelo por área.
- **Permisos:** Matriz rol × permiso con toggles y reset a valores por defecto.
- **Áreas:** Crear y gestionar áreas organizacionales.
- **Perfil:** Editar datos del usuario actual.

---

## Flujo del Agente IA (Tool-Calling)

```
1. Usuario envía mensaje en /app/chat
2. sendChatMessage (server fn) → OpenAI API
   - Incluye system_prompt del área (de ai_settings)
   - Incluye intake_questions configuradas
   - Herramienta disponible: create_request(title, description, objective, process, priority)
3. OpenAI responde con texto conversacional O llama create_request
4. Si llama create_request:
   - Se inserta registro en `requests` (con área del usuario)
   - Se asocia a la conversación actual (request_id en chat_conversations)
   - Se notifica al usuario que la solicitud fue creada
5. La solicitud aparece en /app/board y /app/requests
```

---

## Patrones Arquitectónicos

### Server Functions
Operaciones backend usan `createServerFn` de TanStack Start:
```typescript
const myFn = createServerFn()
  .middleware([requireSupabaseAuth])
  .validator(z.object({...}))
  .handler(async ({ data, context }) => { ... })
```
El middleware extrae el JWT del request y provee `context.user` y `context.supabase`.

### Cliente Supabase lazy
`src/integrations/supabase/client.ts` usa un `Proxy` para retrasar la inicialización hasta el primer uso (evita errores de SSR cuando las env vars no están disponibles en build time).

### Realtime
- Tablero Kanban y notificaciones usan `supabase.channel()` para actualizaciones en tiempo real.
- Las notificaciones se crean en DB con tipo (`request_created`, `request_assigned`, `status_changed`, `comment_added`, etc.) y el panel las muestra con badge de no-leídas.

---

## Convenciones de Código

- Todo el UI en **español**.
- Fecha con `date-fns` y locale `es`.
- Componentes UI via shadcn (en `src/components/ui/`) — no reinventar.
- `cn()` de `src/lib/utils.ts` para clases condicionales (clsx + tailwind-merge).
- Validación con **Zod** en server functions; React Hook Form en formularios.
- No hay Redux/Zustand — estado global via React Context; estado servidor via React Query o direct Supabase calls.

---

## Estado de Producción

- Código funcional ~70% production-ready.
- Faltan variables de entorno (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) para activar IA y operaciones admin.
- Sin tests E2E.
- Sin rate limiting en server functions de OpenAI.
- Sin verificación de email en Supabase Auth.
