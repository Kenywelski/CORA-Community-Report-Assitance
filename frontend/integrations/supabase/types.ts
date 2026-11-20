export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_logs: {
        Row: {
          action: string
          actor: string
          confidence: number | null
          created_at: string
          decision: string | null
          department_id: string | null
          id: string
          metadata: Json
          reasoning: string | null
          report_id: string | null
        }
        Insert: {
          action: string
          actor?: string
          confidence?: number | null
          created_at?: string
          decision?: string | null
          department_id?: string | null
          id?: string
          metadata?: Json
          reasoning?: string | null
          report_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          confidence?: number | null
          created_at?: string
          decision?: string | null
          department_id?: string | null
          id?: string
          metadata?: Json
          reasoning?: string | null
          report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "community_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_report_feed"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          excerpt: string | null
          id: string
          image_url: string | null
          is_active: boolean
          published_at: string
          title: string
          type: Database["public"]["Enums"]["announcement_type"]
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          published_at?: string
          title: string
          type?: Database["public"]["Enums"]["announcement_type"]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          published_at?: string
          title?: string
          type?: Database["public"]["Enums"]["announcement_type"]
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          mode: string
          status: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          mode: string
          status?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          mode?: string
          status?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      community_reports: {
        Row: {
          acknowledged_at: string | null
          action_taken: string | null
          admin_notes: string | null
          admin_overridden: boolean
          admin_review_notes: string | null
          admin_review_status: string
          ai_category: string | null
          ai_confidence: number | null
          ai_department_id: string | null
          ai_priority: string | null
          ai_processed_at: string | null
          ai_reason: string | null
          ai_validated_at: string | null
          ai_validation_confidence: number | null
          ai_validation_elements: Json
          ai_validation_reason: string | null
          ai_validation_status: string
          assigned_department: string | null
          assigned_to: string | null
          category: string
          category_id: string | null
          created_at: string
          department_id: string | null
          description: string
          due_at: string | null
          escalated_at: string | null
          id: string
          is_public: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          media_types: string[] | null
          media_urls: string[] | null
          photo_url: string | null
          reporter_contact: string | null
          reporter_name: string | null
          requested_public: boolean
          requires_review: boolean
          resolved_at: string | null
          response_at: string | null
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
          user_id: string | null
          verification_session_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          action_taken?: string | null
          admin_notes?: string | null
          admin_overridden?: boolean
          admin_review_notes?: string | null
          admin_review_status?: string
          ai_category?: string | null
          ai_confidence?: number | null
          ai_department_id?: string | null
          ai_priority?: string | null
          ai_processed_at?: string | null
          ai_reason?: string | null
          ai_validated_at?: string | null
          ai_validation_confidence?: number | null
          ai_validation_elements?: Json
          ai_validation_reason?: string | null
          ai_validation_status?: string
          assigned_department?: string | null
          assigned_to?: string | null
          category: string
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          description: string
          due_at?: string | null
          escalated_at?: string | null
          id?: string
          is_public?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          media_types?: string[] | null
          media_urls?: string[] | null
          photo_url?: string | null
          reporter_contact?: string | null
          reporter_name?: string | null
          requested_public?: boolean
          requires_review?: boolean
          resolved_at?: string | null
          response_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
          user_id?: string | null
          verification_session_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          action_taken?: string | null
          admin_notes?: string | null
          admin_overridden?: boolean
          admin_review_notes?: string | null
          admin_review_status?: string
          ai_category?: string | null
          ai_confidence?: number | null
          ai_department_id?: string | null
          ai_priority?: string | null
          ai_processed_at?: string | null
          ai_reason?: string | null
          ai_validated_at?: string | null
          ai_validation_confidence?: number | null
          ai_validation_elements?: Json
          ai_validation_reason?: string | null
          ai_validation_status?: string
          assigned_department?: string | null
          assigned_to?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string
          due_at?: string | null
          escalated_at?: string | null
          id?: string
          is_public?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          media_types?: string[] | null
          media_urls?: string[] | null
          photo_url?: string | null
          reporter_contact?: string | null
          reporter_name?: string | null
          requested_public?: boolean
          requires_review?: boolean
          resolved_at?: string | null
          response_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
          user_id?: string | null
          verification_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_ai_department_id_fkey"
            columns: ["ai_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "report_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_verification_session_id_fkey"
            columns: ["verification_session_id"]
            isOneToOne: true
            referencedRelation: "report_verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          response_hours: number
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          response_hours?: number
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          response_hours?: number
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          address: string | null
          availability: string
          contact_number: string
          created_at: string
          created_by: string | null
          department_name: string
          id: string
          is_active: boolean
          service_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          availability?: string
          contact_number?: string
          created_at?: string
          created_by?: string | null
          department_name: string
          id?: string
          is_active?: boolean
          service_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          availability?: string
          contact_number?: string
          created_at?: string
          created_by?: string | null
          department_name?: string
          id?: string
          is_active?: boolean
          service_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          barangay: string | null
          created_at: string
          full_name: string | null
          id: string
          is_test_account: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          barangay?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_test_account?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          barangay?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_test_account?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_verification_sessions: {
        Row: {
          accuracy_meters: number
          capture_mode: string
          consumed_at: string | null
          created_at: string
          duplicate_report_id: string | null
          duplicate_status: string
          expires_at: string
          id: string
          image_sha256: string
          latitude: number
          location_timestamp: number
          longitude: number
          predicted_category: string
          predicted_confidence: number
          user_id: string | null
        }
        Insert: {
          accuracy_meters: number
          capture_mode: string
          consumed_at?: string | null
          created_at?: string
          duplicate_report_id?: string | null
          duplicate_status?: string
          expires_at: string
          id?: string
          image_sha256: string
          latitude: number
          location_timestamp: number
          longitude: number
          predicted_category: string
          predicted_confidence: number
          user_id?: string | null
        }
        Update: {
          accuracy_meters?: number
          capture_mode?: string
          consumed_at?: string | null
          created_at?: string
          duplicate_report_id?: string | null
          duplicate_status?: string
          expires_at?: string
          id?: string
          image_sha256?: string
          latitude?: number
          location_timestamp?: number
          longitude?: number
          predicted_category?: string
          predicted_confidence?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_verification_sessions_duplicate_report_id_fkey"
            columns: ["duplicate_report_id"]
            isOneToOne: false
            referencedRelation: "community_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_categories: {
        Row: {
          created_at: string
          default_department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          keywords: string[]
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_categories_default_department_id_fkey"
            columns: ["default_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      report_comments: {
        Row: {
          author_name: string | null
          content: string
          created_at: string
          id: string
          is_official: boolean
          report_id: string
          user_id: string | null
        }
        Insert: {
          author_name?: string | null
          content: string
          created_at?: string
          id?: string
          is_official?: boolean
          report_id: string
          user_id?: string | null
        }
        Update: {
          author_name?: string | null
          content?: string
          created_at?: string
          id?: string
          is_official?: boolean
          report_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "community_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_report_feed"
            referencedColumns: ["id"]
          },
        ]
      }
      report_follows: {
        Row: {
          created_at: string
          id: string
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_follows_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "community_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_follows_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_report_feed"
            referencedColumns: ["id"]
          },
        ]
      }
      report_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          report_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          report_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          report_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "community_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_report_feed"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_feedback: {
        Row: {
          created_at: string
          id: string
          is_anonymous: boolean
          is_reviewed: boolean
          message: string
          rating: number | null
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_reviewed?: boolean
          message: string
          rating?: number | null
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_reviewed?: boolean
          message?: string
          rating?: number | null
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_accounts: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_accounts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_login_activity: {
        Row: {
          id: string
          ip_address: string | null
          login_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_report_feed: {
        Row: {
          admin_notes: string | null
          assigned_department: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          media_urls: string[] | null
          photo_url: string | null
          reporter_name: string | null
          resolved_at: string | null
          response_at: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: never
          assigned_department?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          media_urls?: string[] | null
          photo_url?: string | null
          reporter_name?: never
          resolved_at?: string | null
          response_at?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          title?: string | null
          user_id?: never
        }
        Update: {
          admin_notes?: never
          assigned_department?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          media_urls?: string[] | null
          photo_url?: string | null
          reporter_name?: never
          resolved_at?: string | null
          response_at?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          title?: string | null
          user_id?: never
        }
        Relationships: []
      }
    }
    Functions: {
      set_user_primary_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      announcement_type: "general" | "urgent" | "event"
      app_role: "admin" | "moderator" | "user" | "staff"
      request_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "rejected"
        | "under_review"
        | "assigned"
        | "closed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      announcement_type: ["general", "urgent", "event"],
      app_role: ["admin", "moderator", "user", "staff"],
      request_status: [
        "pending",
        "in_progress",
        "completed",
        "rejected",
        "under_review",
        "assigned",
        "closed",
      ],
    },
  },
} as const
