export type AppPermission =
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
  | "manage_areas";

export type AppRole = "super_admin" | "area_admin" | "manager" | "client" | "viewer";

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
  create_requests: "Crear solicitudes",
  edit_own_requests: "Editar mis solicitudes",
  edit_all_requests: "Editar todas las solicitudes",
  delete_own_requests: "Eliminar mis solicitudes",
  delete_all_requests: "Eliminar todas las solicitudes",
  view_all_requests: "Ver todas las solicitudes",
  assign_requests: "Asignar solicitudes",
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
  super_admin: "Super Administrador",
  area_admin: "Administrador de Área",
  admin: "Administrador",
  manager: "Gerente",
  client: "Cliente",
  viewer: "Visualizador",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  super_admin: [
    "create_requests",
    "edit_own_requests",
    "edit_all_requests",
    "delete_own_requests",
    "delete_all_requests",
    "view_all_requests",
    "assign_requests",
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
    "create_requests",
    "edit_own_requests",
    "edit_all_requests",
    "delete_own_requests",
    "delete_all_requests",
    "view_all_requests",
    "assign_requests",
    "manage_users",
    "manage_roles",
    "view_analytics",
    "export_data",
    "use_ai_features",
    "manage_request_expiration",
  ],
  admin: [
    "create_requests",
    "edit_own_requests",
    "edit_all_requests",
    "delete_own_requests",
    "delete_all_requests",
    "view_all_requests",
    "assign_requests",
    "manage_users",
    "manage_roles",
    "manage_permissions",
    "view_analytics",
    "export_data",
    "use_ai_features",
    "manage_settings",
    "manage_request_expiration",
  ],
  manager: [
    "create_requests",
    "edit_own_requests",
    "edit_all_requests",
    "delete_own_requests",
    "delete_all_requests",
    "view_all_requests",
    "assign_requests",
    "view_analytics",
    "export_data",
    "use_ai_features",
    "manage_request_expiration",
  ],
  client: ["create_requests", "edit_own_requests", "delete_own_requests", "use_ai_features"],
  viewer: ["view_all_requests"],
};
