export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      areas: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
          area_id: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          area_id?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          updated_at?: string
          area_id?: string | null
        }
      }
      requests: {
        Row: {
          id: string
          title: string
          description: string | null
          objective: string | null
          process: string | null
          status_column_id: string | null
          priority: 'low' | 'medium' | 'high' | 'urgent'
          created_by: string
          assigned_to: string | null
          custom_data: Json
          position: number
          created_at: string
          updated_at: string
          expires_at: string | null
          completed_at: string | null
          area_id: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          objective?: string | null
          process?: string | null
          status_column_id?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          created_by: string
          assigned_to?: string | null
          custom_data?: Json
          position?: number
          created_at?: string
          updated_at?: string
          expires_at?: string | null
          completed_at?: string | null
          area_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          objective?: string | null
          process?: string | null
          status_column_id?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to?: string | null
          custom_data?: Json
          position?: number
          updated_at?: string
          expires_at?: string | null
          completed_at?: string | null
          area_id?: string | null
        }
      }
      kanban_columns: {
        Row: {
          id: string
          name: string
          position: number
          color: string
          is_completed: boolean
          created_at: string
          updated_at: string
          area_id: string | null
        }
        Insert: {
          id?: string
          name: string
          position?: number
          color?: string
          is_completed?: boolean
          created_at?: string
          updated_at?: string
          area_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          position?: number
          color?: string
          is_completed?: boolean
          updated_at?: string
          area_id?: string | null
        }
      }
      custom_fields: {
        Row: {
          id: string
          name: string
          field_key: string
          field_type: string
          options: Json
          required: boolean
          position: number
          created_at: string
          area_id: string | null
        }
        Insert: {
          id?: string
          name: string
          field_key: string
          field_type?: string
          options?: Json
          required?: boolean
          position?: number
          created_at?: string
          area_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          field_key?: string
          field_type?: string
          options?: Json
          required?: boolean
          position?: number
          area_id?: string | null
        }
      }
      ai_settings: {
        Row: {
          id: string
          system_prompt: string
          intake_questions: Json
          model: string
          is_active: boolean
          updated_at: string
          area_id: string | null
        }
        Insert: {
          id?: string
          system_prompt: string
          intake_questions?: Json
          model?: string
          is_active?: boolean
          updated_at?: string
          area_id?: string | null
        }
        Update: {
          id?: string
          system_prompt?: string
          intake_questions?: Json
          model?: string
          is_active?: boolean
          updated_at?: string
          area_id?: string | null
        }
      }
      user_roles_smart_path: {
        Row: {
          id: string
          user_id: string
          role: 'super_admin' | 'area_admin' | 'manager' | 'client' | 'viewer'
          created_at: string
          area_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: 'super_admin' | 'area_admin' | 'manager' | 'client' | 'viewer'
          created_at?: string
          area_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'super_admin' | 'area_admin' | 'manager' | 'client' | 'viewer'
          area_id?: string | null
        }
      }
      role_permissions: {
        Row: {
          id: string
          role: 'super_admin' | 'area_admin' | 'manager' | 'client' | 'viewer'
          permission: 'create_requests' | 'edit_own_requests' | 'edit_all_requests' | 'delete_own_requests' | 'delete_all_requests' | 'view_all_requests' | 'assign_requests' | 'manage_users' | 'manage_roles' | 'manage_permissions' | 'view_analytics' | 'export_data' | 'use_ai_features' | 'manage_settings' | 'manage_request_expiration' | 'manage_areas'
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          role: 'super_admin' | 'area_admin' | 'manager' | 'client' | 'viewer'
          permission: 'create_requests' | 'edit_own_requests' | 'edit_all_requests' | 'delete_own_requests' | 'delete_all_requests' | 'view_all_requests' | 'assign_requests' | 'manage_users' | 'manage_roles' | 'manage_permissions' | 'view_analytics' | 'export_data' | 'use_ai_features' | 'manage_settings' | 'manage_request_expiration' | 'manage_areas'
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'super_admin' | 'area_admin' | 'manager' | 'client' | 'viewer'
          permission?: 'create_requests' | 'edit_own_requests' | 'edit_all_requests' | 'delete_own_requests' | 'delete_all_requests' | 'view_all_requests' | 'assign_requests' | 'manage_users' | 'manage_roles' | 'manage_permissions' | 'view_analytics' | 'export_data' | 'use_ai_features' | 'manage_settings' | 'manage_request_expiration' | 'manage_areas'
          enabled?: boolean
          updated_at?: string
        }
      }
      chat_conversations: {
        Row: {
          id: string
          user_id: string
          request_id: string | null
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          request_id?: string | null
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          request_id?: string | null
          title?: string | null
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          content?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          read?: boolean
        }
      }
      comments: {
        Row: {
          id: string
          request_id: string
          user_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          user_id?: string
          content?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role_2: 'super_admin' | 'area_admin' | 'manager' | 'client' | 'viewer'
      priority_level: 'low' | 'medium' | 'high' | 'urgent'
      app_permission: 'create_requests' | 'edit_own_requests' | 'edit_all_requests' | 'delete_own_requests' | 'delete_all_requests' | 'view_all_requests' | 'assign_requests' | 'manage_users' | 'manage_roles' | 'manage_permissions' | 'view_analytics' | 'export_data' | 'use_ai_features' | 'manage_settings' | 'manage_request_expiration' | 'manage_areas'
    }
  }
}
