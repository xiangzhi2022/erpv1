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
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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

