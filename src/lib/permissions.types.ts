export type AppPermission =
  | "view_dashboard"
  | "view_board"
  | "view_team"
  | "create_requests"
  | "edit_own_requests"
  | "edit_all_requests"
  | "delete_own_requests"
  | "delete_all_requests"
  | "view_all_requests"
  | "assign_requests"
  | "change_request_status"
  | "manage_users"
  | "manage_roles"
  | "manage_permissions"
  | "view_analytics"
  | "export_data"
  | "use_ai_features"
  | "manage_settings"
  | "manage_request_expiration"
  | "manage_areas";

export type AppRole = "super_admin" | "area_admin" | "manager" | "agent" | "client" | "viewer";

export interface RolePermission {
  id: string;
  role: AppRole;
  permission: AppPermission;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolePermissionsConfig {
  [role: string]: {
    [permission: string]: boolean;
  };
}

export interface PermissionGroup {
  name: string;
  description: string;
  permissions: AppPermission[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: "Acceso a Módulos",
    description: "Permisos para acceder a módulos de la plataforma",
    permissions: ["view_dashboard", "view_board", "view_team"],
  },
  {
    name: "Gestión de Solicitudes",
    description: "Permisos para crear, editar y eliminar solicitudes",
    permissions: [
      "create_requests",
      "edit_own_requests",
      "edit_all_requests",
      "delete_own_requests",
      "delete_all_requests",
      "view_all_requests",
      "assign_requests",
      "change_request_status",
      "manage_request_expiration",
    ],
  },
  {
    name: "Gestión de Usuarios",
    description: "Permisos para administrar usuarios y roles",
    permissions: ["manage_users", "manage_roles", "manage_permissions"],
  },
  {
    name: "Gestión de Áreas",
    description: "Permisos para administrar áreas organizacionales",
    permissions: ["manage_areas"],
  },
  {
    name: "Analíticas y Datos",
    description: "Permisos para ver analíticas y exportar datos",
    permissions: ["view_analytics", "export_data"],
  },
  {
    name: "Funciones IA",
    description: "Permisos para usar características de IA",
    permissions: ["use_ai_features"],
  },
  {
    name: "Configuración",
    description: "Permisos para administrar la configuración del sistema",
    permissions: ["manage_settings"],
  },
];

export const PERMISSION_LABELS: Record<AppPermission, string> = {
  view_dashboard: "Ver dashboard",
  view_board: "Ver tablero",
  view_team: "Ver equipo",
  create_requests: "Crear solicitudes",
  edit_own_requests: "Editar mis solicitudes",
  edit_all_requests: "Editar todas las solicitudes",
  delete_own_requests: "Eliminar mis solicitudes",
  delete_all_requests: "Eliminar todas las solicitudes",
  view_all_requests: "Ver todas las solicitudes",
  assign_requests: "Asignar solicitudes",
  change_request_status: "Cambiar estado de solicitud",
  manage_users: "Gestionar usuarios",
  manage_roles: "Gestionar roles",
  manage_permissions: "Gestionar permisos",
  view_analytics: "Ver analíticas",
  export_data: "Exportar datos",
  use_ai_features: "Usar funciones IA",
  manage_settings: "Gestionar configuración",
  manage_request_expiration: "Gestionar vencimiento de solicitudes",
  manage_areas: "Gestionar áreas",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  area_admin: "Admin Área",
  manager: "Manager",
  agent: "Agent",
  client: "Cliente",
  viewer: "Viewer",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  super_admin: [
    "view_dashboard",
    "view_board",
    "view_team",
    "create_requests",
    "edit_own_requests",
    "edit_all_requests",
    "delete_own_requests",
    "delete_all_requests",
    "view_all_requests",
    "assign_requests",
    "change_request_status",
    "manage_users",
    "manage_roles",
    "manage_permissions",
    "view_analytics",
    "export_data",
    "use_ai_features",
    "manage_settings",
    "manage_request_expiration",
    "manage_areas",
  ],
  area_admin: [
    "view_dashboard",
    "view_board",
    "view_team",
    "create_requests",
    "edit_own_requests",
    "edit_all_requests",
    "delete_own_requests",
    "delete_all_requests",
    "view_all_requests",
    "assign_requests",
    "change_request_status",
    "manage_users",
    "manage_roles",
    "view_analytics",
    "export_data",
    "use_ai_features",
    "manage_request_expiration",
  ],
  manager: [
    "view_dashboard",
    "view_board",
    "view_team",
    "create_requests",
    "edit_own_requests",
    "edit_all_requests",
    "delete_own_requests",
    "delete_all_requests",
    "view_all_requests",
    "assign_requests",
    "change_request_status",
    "view_analytics",
    "export_data",
    "use_ai_features",
    "manage_request_expiration",
  ],
  agent: [
    "view_dashboard", "view_board",
    "create_requests", "edit_own_requests", "edit_all_requests",
    "delete_own_requests", "view_all_requests", "assign_requests",
    "change_request_status", "use_ai_features",
  ],
  client: ["view_dashboard", "view_board", "create_requests", "edit_own_requests", "delete_own_requests", "use_ai_features"],
  viewer: ["view_dashboard", "view_board", "view_all_requests"],
};
