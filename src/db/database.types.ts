export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_idempotency_keys: {
        Row: {
          actor_id: string
          claim_token: string
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          locked_until: string
          request_hash: string
          response_body: Json | null
          response_status: number | null
          state: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actor_id: string
          claim_token: string
          created_at?: string
          expires_at: string
          id?: string
          idempotency_key: string
          locked_until: string
          request_hash: string
          response_body?: Json | null
          response_status?: number | null
          state: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actor_id?: string
          claim_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          locked_until?: string
          request_hash?: string
          response_body?: Json | null
          response_status?: number | null
          state?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_membership_fkey"
            columns: ["tenant_id", "actor_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["tenant_id", "user_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string
          correlation_id: string
          id: string
          ip_hash: string | null
          membership_id: string
          metadata: Json
          metadata_trusted: boolean
          occurred_at: string
          outcome: string
          resource_id: string
          resource_type: string
          tenant_id: string
          user_agent_summary: string | null
        }
        Insert: {
          action: string
          actor_id: string
          correlation_id: string
          id?: string
          ip_hash?: string | null
          membership_id: string
          metadata: Json
          metadata_trusted: boolean
          occurred_at?: string
          outcome: string
          resource_id: string
          resource_type: string
          tenant_id: string
          user_agent_summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          correlation_id?: string
          id?: string
          ip_hash?: string | null
          membership_id?: string
          metadata?: Json
          metadata_trusted?: boolean
          occurred_at?: string
          outcome?: string
          resource_id?: string
          resource_type?: string
          tenant_id?: string
          user_agent_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_membership_actor_fkey"
            columns: ["tenant_id", "membership_id", "actor_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["tenant_id", "id", "user_id"]
          },
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          enterprise_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          enterprise_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          enterprise_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          enterprise_id: string
          id: string
          name: string
          phone: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          enterprise_id: string
          id?: string
          name: string
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          enterprise_id?: string
          id?: string
          name?: string
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      dealers: {
        Row: {
          contact_name: string | null
          created_at: string
          created_by: string | null
          enterprise_id: string
          id: string
          name: string
          phone: string | null
          region: string | null
          remark: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          enterprise_id: string
          id?: string
          name: string
          phone?: string | null
          region?: string | null
          remark?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string
          id?: string
          name?: string
          phone?: string | null
          region?: string | null
          remark?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealers_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          enterprise_id: string
          id: string
          name: string
          parent_id: string | null
          remark: string | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          enterprise_id: string
          id?: string
          name: string
          parent_id?: string | null
          remark?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          enterprise_id?: string
          id?: string
          name?: string
          parent_id?: string | null
          remark?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_enterprise_id_parent_id_fkey"
            columns: ["enterprise_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      employee_positions: {
        Row: {
          created_at: string
          employee_id: string
          enterprise_id: string
          id: string
          is_primary: boolean
          position_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          enterprise_id: string
          id?: string
          is_primary?: boolean
          position_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          enterprise_id?: string
          id?: string
          is_primary?: boolean
          position_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_positions_enterprise_id_employee_id_fkey"
            columns: ["enterprise_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "employee_positions_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_positions_enterprise_id_position_id_fkey"
            columns: ["enterprise_id", "position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      employee_roles: {
        Row: {
          created_at: string
          employee_id: string
          enterprise_id: string
          id: string
          role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          enterprise_id: string
          id?: string
          role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          enterprise_id?: string
          id?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_roles_enterprise_id_employee_id_fkey"
            columns: ["enterprise_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "employee_roles_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_roles_enterprise_id_role_id_fkey"
            columns: ["enterprise_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      employees: {
        Row: {
          avatar_url: string | null
          base_salary: number
          created_at: string
          department_id: string | null
          email: string | null
          employee_no: string
          employee_type: string
          enterprise_id: string
          hire_date: string | null
          id: string
          leave_date: string | null
          name: string
          phone: string | null
          primary_position_id: string | null
          remark: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          base_salary?: number
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_no: string
          employee_type?: string
          enterprise_id: string
          hire_date?: string | null
          id?: string
          leave_date?: string | null
          name: string
          phone?: string | null
          primary_position_id?: string | null
          remark?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          base_salary?: number
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_no?: string
          employee_type?: string
          enterprise_id?: string
          hire_date?: string | null
          id?: string
          leave_date?: string | null
          name?: string
          phone?: string | null
          primary_position_id?: string | null
          remark?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_enterprise_id_department_id_fkey"
            columns: ["enterprise_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "employees_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_enterprise_id_primary_position_id_fkey"
            columns: ["enterprise_id", "primary_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      enterprise_join_requests: {
        Row: {
          created_at: string
          enterprise_id: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string | null
          requested_role_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          requested_role_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          requested_role_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_join_requests_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_memberships: {
        Row: {
          created_at: string
          display_name: string
          id: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprises: {
        Row: {
          code: string
          created_at: string
          enterprise_type: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          enterprise_type: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          enterprise_type?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      factory_workshops: {
        Row: {
          capacity: number
          created_at: string
          current_load: number
          description: string | null
          enterprise_id: string
          factory_code: string | null
          id: string
          location: string | null
          manager: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          current_load?: number
          description?: string | null
          enterprise_id: string
          factory_code?: string | null
          id?: string
          location?: string | null
          manager?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          current_load?: number
          description?: string | null
          enterprise_id?: string
          factory_code?: string | null
          id?: string
          location?: string | null
          manager?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factory_workshops_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_action_requests: {
        Row: {
          action: string
          actor_id: string
          correlation_id: string
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          locked_until: string
          result: Json | null
          state: string
          target_hash: string
          updated_at: string
        }
        Insert: {
          action: string
          actor_id: string
          correlation_id: string
          created_at?: string
          expires_at: string
          id?: string
          idempotency_key: string
          locked_until: string
          result?: Json | null
          state: string
          target_hash: string
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string
          correlation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          locked_until?: string
          result?: Json | null
          state?: string
          target_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          message: string | null
          read: boolean
          recipient_id: string | null
          task_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          message?: string | null
          read?: boolean
          recipient_id?: string | null
          task_id?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          message?: string | null
          read?: boolean
          recipient_id?: string | null
          task_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_enterprise_id_task_id_fkey"
            columns: ["enterprise_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      order_exchanges: {
        Row: {
          created_at: string
          enterprise_id: string
          from_enterprise_id: string
          from_user_id: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string | null
          order_id: string
          proposed_changes: Json | null
          status: string
          to_enterprise_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          from_enterprise_id: string
          from_user_id: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          order_id: string
          proposed_changes?: Json | null
          status?: string
          to_enterprise_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          from_enterprise_id?: string
          from_user_id?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          order_id?: string
          proposed_changes?: Json | null
          status?: string
          to_enterprise_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_exchanges_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exchanges_enterprise_id_order_id_fkey"
            columns: ["enterprise_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "order_exchanges_from_enterprise_id_fkey"
            columns: ["from_enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exchanges_to_enterprise_id_fkey"
            columns: ["to_enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_attachments: {
        Row: {
          created_at: string
          enterprise_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          module_id: string | null
          order_id: string
          order_item_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          module_id?: string | null
          order_id: string
          order_item_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          module_id?: string | null
          order_id?: string
          order_item_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_attachments_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_attachments_enterprise_id_module_id_fkey"
            columns: ["enterprise_id", "module_id"]
            isOneToOne: false
            referencedRelation: "order_modules"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "order_item_attachments_enterprise_id_order_id_fkey"
            columns: ["enterprise_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "order_item_attachments_enterprise_id_order_item_id_fkey"
            columns: ["enterprise_id", "order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      order_items: {
        Row: {
          color: string | null
          construction_surface: string | null
          created_at: string
          enterprise_id: string
          forming_craft: string | null
          hardware: string | null
          hardware_quantity: number | null
          id: string
          item_no: string | null
          length_mm: number | null
          module_id: string | null
          order_id: string
          painting_craft: string | null
          product_name: string
          quantity: number
          remark: string | null
          sort_order: number
          specifications: string | null
          subtotal: number
          thickness_mm: number | null
          unit: string
          unit_price: number
          updated_at: string
          width_mm: number | null
          woodworking_craft: string | null
        }
        Insert: {
          color?: string | null
          construction_surface?: string | null
          created_at?: string
          enterprise_id: string
          forming_craft?: string | null
          hardware?: string | null
          hardware_quantity?: number | null
          id?: string
          item_no?: string | null
          length_mm?: number | null
          module_id?: string | null
          order_id: string
          painting_craft?: string | null
          product_name: string
          quantity?: number
          remark?: string | null
          sort_order?: number
          specifications?: string | null
          subtotal?: number
          thickness_mm?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
          width_mm?: number | null
          woodworking_craft?: string | null
        }
        Update: {
          color?: string | null
          construction_surface?: string | null
          created_at?: string
          enterprise_id?: string
          forming_craft?: string | null
          hardware?: string | null
          hardware_quantity?: number | null
          id?: string
          item_no?: string | null
          length_mm?: number | null
          module_id?: string | null
          order_id?: string
          painting_craft?: string | null
          product_name?: string
          quantity?: number
          remark?: string | null
          sort_order?: number
          specifications?: string | null
          subtotal?: number
          thickness_mm?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
          width_mm?: number | null
          woodworking_craft?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_enterprise_id_module_id_fkey"
            columns: ["enterprise_id", "module_id"]
            isOneToOne: false
            referencedRelation: "order_modules"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "order_items_enterprise_id_order_id_fkey"
            columns: ["enterprise_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      order_modules: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          module_name: string
          module_no: string
          order_id: string
          remark: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          module_name: string
          module_no: string
          order_id: string
          remark?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          module_name?: string
          module_no?: string
          order_id?: string
          remark?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_modules_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_modules_enterprise_id_order_id_fkey"
            columns: ["enterprise_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      order_prefixes: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          current_val: number
          enterprise_id: string
          id: string
          name: string
          phone: string | null
          prefix: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          current_val?: number
          enterprise_id: string
          id?: string
          name: string
          phone?: string | null
          prefix: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          current_val?: number
          enterprise_id?: string
          id?: string
          name?: string
          phone?: string | null
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_prefixes_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      order_products: {
        Row: {
          area: number | null
          color: string | null
          cost_amount: number
          created_at: string
          depth: number | null
          enterprise_id: string
          height: number | null
          id: string
          internal_remark: string | null
          material: string | null
          order_id: string
          product_model: string | null
          product_name: string
          product_no: string
          product_type: string
          profit_amount: number
          quantity: number
          quoted_amount: number
          remark: string | null
          sort_order: number
          space_id: string
          status: string
          updated_at: string
          width: number | null
        }
        Insert: {
          area?: number | null
          color?: string | null
          cost_amount?: number
          created_at?: string
          depth?: number | null
          enterprise_id: string
          height?: number | null
          id?: string
          internal_remark?: string | null
          material?: string | null
          order_id: string
          product_model?: string | null
          product_name: string
          product_no: string
          product_type?: string
          profit_amount?: number
          quantity?: number
          quoted_amount?: number
          remark?: string | null
          sort_order?: number
          space_id: string
          status?: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          area?: number | null
          color?: string | null
          cost_amount?: number
          created_at?: string
          depth?: number | null
          enterprise_id?: string
          height?: number | null
          id?: string
          internal_remark?: string | null
          material?: string | null
          order_id?: string
          product_model?: string | null
          product_name?: string
          product_no?: string
          product_type?: string
          profit_amount?: number
          quantity?: number
          quoted_amount?: number
          remark?: string | null
          sort_order?: number
          space_id?: string
          status?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_products_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_products_enterprise_id_order_id_fkey"
            columns: ["enterprise_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "order_products_enterprise_id_space_id_fkey"
            columns: ["enterprise_id", "space_id"]
            isOneToOne: false
            referencedRelation: "order_spaces"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      order_spaces: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          order_id: string
          remark: string | null
          sort_order: number
          space_name: string
          space_no: string
          space_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          order_id: string
          remark?: string | null
          sort_order?: number
          space_name: string
          space_no: string
          space_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          order_id?: string
          remark?: string | null
          sort_order?: number
          space_name?: string
          space_no?: string
          space_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_spaces_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_spaces_enterprise_id_order_id_fkey"
            columns: ["enterprise_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      order_status_logs: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          enterprise_id: string
          from_status: string | null
          id: string
          remark: string | null
          target_id: string
          target_type: string
          to_status: string
          updated_at: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          enterprise_id: string
          from_status?: string | null
          id?: string
          remark?: string | null
          target_id: string
          target_type: string
          to_status: string
          updated_at?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          enterprise_id?: string
          from_status?: string | null
          id?: string
          remark?: string | null
          target_id?: string
          target_type?: string
          to_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_logs_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cost_amount: number
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_name: string
          customer_phone: string | null
          dealer_id: string | null
          delivery_date: string | null
          deposit_amount: number
          enterprise_id: string
          from_enterprise_id: string | null
          id: string
          internal_remark: string | null
          order_flow: string
          order_no: string
          order_source: string | null
          parent_order_id: string | null
          profit_amount: number
          remark: string | null
          status: string
          target_factory_id: string | null
          to_enterprise_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          cost_amount?: number
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name: string
          customer_phone?: string | null
          dealer_id?: string | null
          delivery_date?: string | null
          deposit_amount?: number
          enterprise_id: string
          from_enterprise_id?: string | null
          id?: string
          internal_remark?: string | null
          order_flow?: string
          order_no: string
          order_source?: string | null
          parent_order_id?: string | null
          profit_amount?: number
          remark?: string | null
          status?: string
          target_factory_id?: string | null
          to_enterprise_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cost_amount?: number
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string | null
          dealer_id?: string | null
          delivery_date?: string | null
          deposit_amount?: number
          enterprise_id?: string
          from_enterprise_id?: string | null
          id?: string
          internal_remark?: string | null
          order_flow?: string
          order_no?: string
          order_source?: string | null
          parent_order_id?: string | null
          profit_amount?: number
          remark?: string | null
          status?: string
          target_factory_id?: string | null
          to_enterprise_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_enterprise_id_parent_order_id_fkey"
            columns: ["enterprise_id", "parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "orders_from_enterprise_id_fkey"
            columns: ["from_enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_target_factory_id_fkey"
            columns: ["target_factory_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_to_enterprise_id_fkey"
            columns: ["to_enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      org_units: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          site_id: string | null
          tenant_id: string
          unit_type: Database["public"]["Enums"]["org_unit_type"]
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          site_id?: string | null
          tenant_id: string
          unit_type: Database["public"]["Enums"]["org_unit_type"]
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          site_id?: string | null
          tenant_id?: string
          unit_type?: Database["public"]["Enums"]["org_unit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "org_units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_units_tenant_id_parent_id_fkey"
            columns: ["tenant_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "org_units_tenant_id_site_id_fkey"
            columns: ["tenant_id", "site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      permission_catalog: {
        Row: {
          code: string
          created_at: string
          description: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          can_assign_task: boolean
          can_calculate_piece_wage: boolean
          can_receive_production_task: boolean
          can_review_task: boolean
          code: string
          created_at: string
          default_role_code: string | null
          department_id: string | null
          enterprise_id: string
          id: string
          name: string
          position_type: string
          remark: string | null
          status: string
          updated_at: string
        }
        Insert: {
          can_assign_task?: boolean
          can_calculate_piece_wage?: boolean
          can_receive_production_task?: boolean
          can_review_task?: boolean
          code: string
          created_at?: string
          default_role_code?: string | null
          department_id?: string | null
          enterprise_id: string
          id?: string
          name: string
          position_type?: string
          remark?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          can_assign_task?: boolean
          can_calculate_piece_wage?: boolean
          can_receive_production_task?: boolean
          can_review_task?: boolean
          code?: string
          created_at?: string
          default_role_code?: string | null
          department_id?: string | null
          enterprise_id?: string
          id?: string
          name?: string
          position_type?: string
          remark?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_enterprise_id_department_id_fkey"
            columns: ["enterprise_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "positions_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      production_tasks: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          approved_at: string | null
          approved_by: string | null
          area: number | null
          assigned_to: string | null
          assigned_worker_id: string | null
          color: string | null
          completed: number
          completed_at: string | null
          created_at: string
          end_date: string | null
          enterprise_id: string
          estimated_wage_amount: number
          final_wage_amount: number
          id: string
          length: number | null
          material: string | null
          order_id: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          priority: number
          process_name: string | null
          product_id: string | null
          product_name: string
          progress: string
          quantity: number
          remark: string | null
          space_id: string | null
          start_date: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          task_code: string | null
          task_name: string | null
          task_no: string | null
          task_type: string
          thickness: number | null
          unit: string
          updated_at: string
          wage_rule_id: string | null
          width: number | null
          work_order_id: string | null
          worker_id: string | null
          workshop_id: string | null
          workstation_id: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          area?: number | null
          assigned_to?: string | null
          assigned_worker_id?: string | null
          color?: string | null
          completed?: number
          completed_at?: string | null
          created_at?: string
          end_date?: string | null
          enterprise_id: string
          estimated_wage_amount?: number
          final_wage_amount?: number
          id?: string
          length?: number | null
          material?: string | null
          order_id?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: number
          process_name?: string | null
          product_id?: string | null
          product_name: string
          progress?: string
          quantity?: number
          remark?: string | null
          space_id?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          task_code?: string | null
          task_name?: string | null
          task_no?: string | null
          task_type?: string
          thickness?: number | null
          unit?: string
          updated_at?: string
          wage_rule_id?: string | null
          width?: number | null
          work_order_id?: string | null
          worker_id?: string | null
          workshop_id?: string | null
          workstation_id?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          area?: number | null
          assigned_to?: string | null
          assigned_worker_id?: string | null
          color?: string | null
          completed?: number
          completed_at?: string | null
          created_at?: string
          end_date?: string | null
          enterprise_id?: string
          estimated_wage_amount?: number
          final_wage_amount?: number
          id?: string
          length?: number | null
          material?: string | null
          order_id?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: number
          process_name?: string | null
          product_id?: string | null
          product_name?: string
          progress?: string
          quantity?: number
          remark?: string | null
          space_id?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          task_code?: string | null
          task_name?: string | null
          task_no?: string | null
          task_type?: string
          thickness?: number | null
          unit?: string
          updated_at?: string
          wage_rule_id?: string | null
          width?: number | null
          work_order_id?: string | null
          worker_id?: string | null
          workshop_id?: string | null
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_tasks_enterprise_id_assigned_worker_id_fkey"
            columns: ["enterprise_id", "assigned_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "production_tasks_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tasks_enterprise_id_order_id_fkey"
            columns: ["enterprise_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "production_tasks_enterprise_id_product_id_fkey"
            columns: ["enterprise_id", "product_id"]
            isOneToOne: false
            referencedRelation: "order_products"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "production_tasks_enterprise_id_space_id_fkey"
            columns: ["enterprise_id", "space_id"]
            isOneToOne: false
            referencedRelation: "order_spaces"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "production_tasks_enterprise_id_wage_rule_id_fkey"
            columns: ["enterprise_id", "wage_rule_id"]
            isOneToOne: false
            referencedRelation: "wage_rules"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "production_tasks_enterprise_id_work_order_id_fkey"
            columns: ["enterprise_id", "work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "production_tasks_enterprise_id_worker_id_fkey"
            columns: ["enterprise_id", "worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "production_tasks_enterprise_id_workshop_id_fkey"
            columns: ["enterprise_id", "workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "production_tasks_enterprise_id_workstation_id_fkey"
            columns: ["enterprise_id", "workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          enterprise_id: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          enterprise_id: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          enterprise_id?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_logs: {
        Row: {
          action: string
          completed_delta: number
          created_at: string
          enterprise_id: string
          id: string
          operator_id: string | null
          operator_name: string | null
          remark: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          action: string
          completed_delta?: number
          created_at?: string
          enterprise_id: string
          id?: string
          operator_id?: string | null
          operator_name?: string | null
          remark?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          action?: string
          completed_delta?: number
          created_at?: string
          enterprise_id?: string
          id?: string
          operator_id?: string | null
          operator_name?: string | null
          remark?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_logs_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_logs_enterprise_id_work_order_id_fkey"
            columns: ["enterprise_id", "work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      role_binding_sites: {
        Row: {
          binding_id: string
          created_at: string
          scope_kind: string
          site_id: string
          tenant_id: string
        }
        Insert: {
          binding_id: string
          created_at?: string
          scope_kind?: string
          site_id: string
          tenant_id: string
        }
        Update: {
          binding_id?: string
          created_at?: string
          scope_kind?: string
          site_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_binding_sites_tenant_id_binding_id_scope_kind_fkey"
            columns: ["tenant_id", "binding_id", "scope_kind"]
            isOneToOne: false
            referencedRelation: "role_bindings"
            referencedColumns: ["tenant_id", "id", "scope_kind"]
          },
          {
            foreignKeyName: "role_binding_sites_tenant_id_site_id_fkey"
            columns: ["tenant_id", "site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      role_binding_workshops: {
        Row: {
          binding_id: string
          created_at: string
          scope_kind: string
          tenant_id: string
          workshop_id: string
        }
        Insert: {
          binding_id: string
          created_at?: string
          scope_kind?: string
          tenant_id: string
          workshop_id: string
        }
        Update: {
          binding_id?: string
          created_at?: string
          scope_kind?: string
          tenant_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_binding_workshops_tenant_id_binding_id_scope_kind_fkey"
            columns: ["tenant_id", "binding_id", "scope_kind"]
            isOneToOne: false
            referencedRelation: "role_bindings"
            referencedColumns: ["tenant_id", "id", "scope_kind"]
          },
          {
            foreignKeyName: "role_binding_workshops_tenant_id_workshop_id_fkey"
            columns: ["tenant_id", "workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      role_bindings: {
        Row: {
          created_at: string
          id: string
          membership_id: string
          role_id: string
          scope_kind: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          membership_id: string
          role_id: string
          scope_kind: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_id?: string
          role_id?: string
          scope_kind?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_bindings_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "enterprise_memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "role_bindings_tenant_id_role_id_fkey"
            columns: ["tenant_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_code: string
          role_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          permission_code: string
          role_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          permission_code?: string
          role_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permission_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_role_id_fkey"
            columns: ["tenant_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          site_type: string
          status: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          site_type: string
          status?: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          site_type?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          category: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          enterprise_id: string
          id: string
          name: string
          phone: string | null
          rating: string
          remark: string | null
          status: string
          supplier_code: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          enterprise_id: string
          id?: string
          name: string
          phone?: string | null
          rating?: string
          remark?: string | null
          status?: string
          supplier_code: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          enterprise_id?: string
          id?: string
          name?: string
          phone?: string | null
          rating?: string
          remark?: string | null
          status?: string
          supplier_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_avatar: string | null
          assignee_id: string | null
          assignee_name: string | null
          category_id: string | null
          completed: boolean
          created_at: string
          description: string | null
          due_date: string | null
          enterprise_id: string
          id: string
          priority: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_avatar?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          category_id?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          enterprise_id: string
          id?: string
          priority?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_avatar?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          category_id?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          enterprise_id?: string
          id?: string
          priority?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_enterprise_id_category_id_fkey"
            columns: ["enterprise_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "tasks_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      wage_rules: {
        Row: {
          calculation_method: string
          created_at: string
          created_by: string | null
          enabled: boolean
          enterprise_id: string
          extra_amount: number
          id: string
          position_id: string | null
          process_name: string | null
          product_type: string | null
          role_scope: string | null
          rule_name: string
          scope_type: string
          task_type: string
          unit: string
          unit_price: number
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          calculation_method?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          enterprise_id: string
          extra_amount?: number
          id?: string
          position_id?: string | null
          process_name?: string | null
          product_type?: string | null
          role_scope?: string | null
          rule_name: string
          scope_type?: string
          task_type: string
          unit?: string
          unit_price?: number
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          calculation_method?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          enterprise_id?: string
          extra_amount?: number
          id?: string
          position_id?: string | null
          process_name?: string | null
          product_type?: string | null
          role_scope?: string | null
          rule_name?: string
          scope_type?: string
          task_type?: string
          unit?: string
          unit_price?: number
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wage_rules_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wage_rules_enterprise_id_position_id_fkey"
            columns: ["enterprise_id", "position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "wage_rules_enterprise_id_worker_id_fkey"
            columns: ["enterprise_id", "worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_end_date: string | null
          completed_quantity: number
          created_at: string
          enterprise_id: string
          expected_end_date: string | null
          factory_id: string | null
          id: string
          order_id: string | null
          priority: string
          product_name: string
          remark: string | null
          start_date: string | null
          status: string
          target_quantity: number
          updated_at: string
          workshop_id: string | null
        }
        Insert: {
          actual_end_date?: string | null
          completed_quantity?: number
          created_at?: string
          enterprise_id: string
          expected_end_date?: string | null
          factory_id?: string | null
          id?: string
          order_id?: string | null
          priority?: string
          product_name: string
          remark?: string | null
          start_date?: string | null
          status?: string
          target_quantity: number
          updated_at?: string
          workshop_id?: string | null
        }
        Update: {
          actual_end_date?: string | null
          completed_quantity?: number
          created_at?: string
          enterprise_id?: string
          expected_end_date?: string | null
          factory_id?: string | null
          id?: string
          order_id?: string | null
          priority?: string
          product_name?: string
          remark?: string | null
          start_date?: string | null
          status?: string
          target_quantity?: number
          updated_at?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_enterprise_id_order_id_fkey"
            columns: ["enterprise_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "work_orders_enterprise_id_workshop_id_fkey"
            columns: ["enterprise_id", "workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "work_orders_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_wage_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          enterprise_id: string
          id: string
          order_id: string | null
          paid_at: string | null
          product_id: string | null
          quantity: number
          space_id: string | null
          status: string
          submitted_at: string | null
          task_id: string
          unit_price: number
          updated_at: string
          wage_amount: number
          wage_rule_id: string | null
          worker_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          enterprise_id: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          product_id?: string | null
          quantity?: number
          space_id?: string | null
          status?: string
          submitted_at?: string | null
          task_id: string
          unit_price?: number
          updated_at?: string
          wage_amount?: number
          wage_rule_id?: string | null
          worker_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          enterprise_id?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          product_id?: string | null
          quantity?: number
          space_id?: string | null
          status?: string
          submitted_at?: string | null
          task_id?: string
          unit_price?: number
          updated_at?: string
          wage_amount?: number
          wage_rule_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_wage_records_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_wage_records_enterprise_id_task_id_fkey"
            columns: ["enterprise_id", "task_id"]
            isOneToOne: false
            referencedRelation: "production_tasks"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "worker_wage_records_enterprise_id_wage_rule_id_fkey"
            columns: ["enterprise_id", "wage_rule_id"]
            isOneToOne: false
            referencedRelation: "wage_rules"
            referencedColumns: ["enterprise_id", "id"]
          },
          {
            foreignKeyName: "worker_wage_records_enterprise_id_worker_id_fkey"
            columns: ["enterprise_id", "worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["enterprise_id", "id"]
          },
        ]
      }
      workers: {
        Row: {
          can_calculate_piece_wage: boolean
          can_receive_production_task: boolean
          craft_type: string | null
          created_at: string
          created_by: string | null
          enterprise_id: string
          gender: string | null
          hire_date: string | null
          id: string
          name: string
          phone: string | null
          remark: string | null
          skill_tags: Json | null
          status: string
          updated_at: string
          user_id: string | null
          worker_no: string
          workshop_id: string | null
        }
        Insert: {
          can_calculate_piece_wage?: boolean
          can_receive_production_task?: boolean
          craft_type?: string | null
          created_at?: string
          created_by?: string | null
          enterprise_id: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          name: string
          phone?: string | null
          remark?: string | null
          skill_tags?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
          worker_no: string
          workshop_id?: string | null
        }
        Update: {
          can_calculate_piece_wage?: boolean
          can_receive_production_task?: boolean
          craft_type?: string | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          name?: string
          phone?: string | null
          remark?: string | null
          skill_tags?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
          worker_no?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_enterprise_id_workshop_id_fkey"
            columns: ["enterprise_id", "workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      workshops: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          site_id: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          site_id: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          site_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshops_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_tenant_id_site_id_fkey"
            columns: ["tenant_id", "site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      workstations: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          status: string
          tenant_id: string
          workshop_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          status?: string
          tenant_id: string
          workshop_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
          tenant_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workstations_tenant_id_workshop_id_fkey"
            columns: ["tenant_id", "workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authorize_enterprise_selection: {
        Args: {
          caller_user_agent?: string
          target_correlation_id: string
          target_enterprise_id: string
          target_idempotency_key: string
        }
        Returns: {
          allowed: boolean
          membership_id: string
          tenant_id: string
        }[]
      }
      current_enterprise_grants: {
        Args: { target_tenant_id: string }
        Returns: {
          permission: string
          scope_kind: string
          site_ids: string[]
          workshop_ids: string[]
        }[]
      }
    }
    Enums: {
      membership_status: "invited" | "active" | "suspended"
      org_unit_type: "department" | "team"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      membership_status: ["invited", "active", "suspended"],
      org_unit_type: ["department", "team"],
    },
  },
} as const

