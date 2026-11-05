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
      advocate_locations: {
        Row: {
          advocate_id: string
          location_id: string
        }
        Insert: {
          advocate_id: string
          location_id: string
        }
        Update: {
          advocate_id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advocate_locations_advocate_id_fkey"
            columns: ["advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advocate_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      advocates: {
        Row: {
          active: boolean
          bar_number: string | null
          bio: string
          buffer_minutes: number
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          designation: string
          email: string | null
          id: string
          is_deleted: boolean
          name: string
          phone: string
          photo_url: string | null
          slot_minutes: number
          specializations: string[]
          user_id: string | null
          years_experience: number
        }
        Insert: {
          active?: boolean
          bar_number?: string | null
          bio?: string
          buffer_minutes?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          designation?: string
          email?: string | null
          id?: string
          is_deleted?: boolean
          name: string
          phone?: string
          photo_url?: string | null
          slot_minutes?: number
          specializations?: string[]
          user_id?: string | null
          years_experience?: number
        }
        Update: {
          active?: boolean
          bar_number?: string | null
          bio?: string
          buffer_minutes?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          designation?: string
          email?: string | null
          id?: string
          is_deleted?: boolean
          name?: string
          phone?: string
          photo_url?: string | null
          slot_minutes?: number
          specializations?: string[]
          user_id?: string | null
          years_experience?: number
        }
        Relationships: []
      }
      appointments: {
        Row: {
          access_token_hash: string
          advocate_id: string
          booking_ref: string
          client_email: string
          client_name: string
          client_phone: string
          consent_at: string | null
          consultation_fee: number | null
          consultation_mode: string | null
          created_at: string
          decline_reason: string | null
          ends_at: string
          id: string
          location_id: string
          matter_description: string
          opposing_party: string
          service_id: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          access_token_hash: string
          advocate_id: string
          booking_ref: string
          client_email: string
          client_name: string
          client_phone: string
          consent_at?: string | null
          consultation_fee?: number | null
          consultation_mode?: string | null
          created_at?: string
          decline_reason?: string | null
          ends_at: string
          id?: string
          location_id: string
          matter_description?: string
          opposing_party?: string
          service_id: string
          source?: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          access_token_hash?: string
          advocate_id?: string
          booking_ref?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          consent_at?: string | null
          consultation_fee?: number | null
          consultation_mode?: string | null
          created_at?: string
          decline_reason?: string | null
          ends_at?: string
          id?: string
          location_id?: string
          matter_description?: string
          opposing_party?: string
          service_id?: string
          source?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_advocate_id_fkey"
            columns: ["advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      availability: {
        Row: {
          advocate_id: string
          end_time: string
          id: string
          location_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          advocate_id: string
          end_time: string
          id?: string
          location_id: string
          start_time: string
          weekday: number
        }
        Update: {
          advocate_id?: string
          end_time?: string
          id?: string
          location_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_advocate_id_fkey"
            columns: ["advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_times: {
        Row: {
          advocate_id: string
          ends_at: string
          id: string
          kind: string
          location_id: string | null
          starts_at: string
          title: string
        }
        Insert: {
          advocate_id: string
          ends_at: string
          id?: string
          kind?: string
          location_id?: string | null
          starts_at: string
          title?: string
        }
        Update: {
          advocate_id?: string
          ends_at?: string
          id?: string
          kind?: string
          location_id?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_times_advocate_id_fkey"
            columns: ["advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_holds: {
        Row: {
          advocate_id: string
          consultation_mode: string | null
          ends_at: string
          expires_at: string
          explicit_advocate_id: string | null
          id: string
          location_id: string
          service_id: string
          simplified_booking: boolean
          starts_at: string
          token_hash: string
        }
        Insert: {
          advocate_id: string
          consultation_mode?: string | null
          ends_at: string
          expires_at: string
          explicit_advocate_id?: string | null
          id?: string
          location_id: string
          service_id: string
          simplified_booking?: boolean
          starts_at: string
          token_hash: string
        }
        Update: {
          advocate_id?: string
          consultation_mode?: string | null
          ends_at?: string
          expires_at?: string
          explicit_advocate_id?: string | null
          id?: string
          location_id?: string
          service_id?: string
          simplified_booking?: boolean
          starts_at?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_holds_advocate_id_fkey"
            columns: ["advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_explicit_advocate_id_fkey"
            columns: ["explicit_advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          accept_online_bookings: boolean
          allow_timezone_change: boolean
          contact_email: string
          contact_phone: string
          default_meeting_minutes: number
          id: number
          max_advance_days: number
          min_notice_hours: number
          show_first_available: boolean
          slot_hold_minutes: number
          staff_can_manage_directory: boolean
          time_format: string
          updated_at: string
        }
        Insert: {
          accept_online_bookings?: boolean
          allow_timezone_change?: boolean
          contact_email?: string
          contact_phone?: string
          default_meeting_minutes?: number
          id?: number
          max_advance_days?: number
          min_notice_hours?: number
          show_first_available?: boolean
          slot_hold_minutes?: number
          staff_can_manage_directory?: boolean
          time_format?: string
          updated_at?: string
        }
        Update: {
          accept_online_bookings?: boolean
          allow_timezone_change?: boolean
          contact_email?: string
          contact_phone?: string
          default_meeting_minutes?: number
          id?: number
          max_advance_days?: number
          min_notice_hours?: number
          show_first_available?: boolean
          slot_hold_minutes?: number
          staff_can_manage_directory?: boolean
          time_format?: string
          updated_at?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          advocate_id: string
          end_date: string
          id: string
          reason: string
          start_date: string
        }
        Insert: {
          advocate_id: string
          end_date: string
          id?: string
          reason?: string
          start_date: string
        }
        Update: {
          advocate_id?: string
          end_date?: string
          id?: string
          reason?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_advocate_id_fkey"
            columns: ["advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string
          city: string
          created_at: string
          default_hours: Json
          deleted_at: string | null
          deleted_by: string | null
          email: string
          holidays: string[]
          id: string
          is_deleted: boolean
          kind: string
          name: string
          phone: string
          sort_order: number
          timezone: string
        }
        Insert: {
          active?: boolean
          address?: string
          city?: string
          created_at?: string
          default_hours?: Json
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          holidays?: string[]
          id?: string
          is_deleted?: boolean
          kind?: string
          name: string
          phone?: string
          sort_order?: number
          timezone?: string
        }
        Update: {
          active?: boolean
          address?: string
          city?: string
          created_at?: string
          default_hours?: Json
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          holidays?: string[]
          id?: string
          is_deleted?: boolean
          kind?: string
          name?: string
          phone?: string
          sort_order?: number
          timezone?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          id: string
          identifier: string
          ip: string
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          ip?: string
          success: boolean
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          ip?: string
          success?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          advocate_id: string | null
          appointment_id: string | null
          audience: string
          body: string
          created_at: string
          id: string
          read_at: string | null
          title: string
        }
        Insert: {
          advocate_id?: string | null
          appointment_id?: string | null
          audience: string
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
        }
        Update: {
          advocate_id?: string | null
          appointment_id?: string | null
          audience?: string
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_advocate_id_fkey"
            columns: ["advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      request_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          description: string
          duration_minutes: number
          fee: number | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          description?: string
          duration_minutes: number
          fee?: number | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          description?: string
          duration_minutes?: number
          fee?: number | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string
          full_name: string
          is_deleted: boolean
          last_login_at: string | null
          must_change_password: boolean
          phone: string
          sessions_revoked_at: string | null
          status: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          full_name?: string
          is_deleted?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          phone?: string
          sessions_revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          full_name?: string
          is_deleted?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          phone?: string
          sessions_revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      staff_scopes: {
        Row: {
          advocate_id: string | null
          id: string
          location_id: string | null
          user_id: string
        }
        Insert: {
          advocate_id?: string | null
          id?: string
          location_id?: string | null
          user_id: string
        }
        Update: {
          advocate_id?: string | null
          id?: string
          location_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_scopes_advocate_id_fkey"
            columns: ["advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_scopes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_appointment_hold: {
        Args: {
          _advocate: string
          _client_key: string
          _location: string
          _mode: string
          _previous_token?: string
          _service: string
          _start: string
        }
        Returns: {
          expires_at: string
          message: string
          ok: boolean
          token: string
        }[]
      }
      acquire_booking_hold: {
        Args: {
          _advocate: string
          _client_key: string
          _location: string
          _previous_token?: string
          _service: string
          _start: string
        }
        Returns: {
          advocate_id: string
          expires_at: string
          message: string
          ok: boolean
          token: string
        }[]
      }
      admin_delete_advocate: { Args: { _id: string }; Returns: string }
      admin_delete_location: { Args: { _id: string }; Returns: string }
      admin_resolve_appointment: {
        Args: { _action: string; _id: string; _target?: string }
        Returns: undefined
      }
      admin_save_advocate: {
        Args: { _data: Json; _hours: Json; _id: string; _locations: string[] }
        Returns: string
      }
      admin_save_location: {
        Args: { _data: Json; _id: string }
        Returns: string
      }
      admin_set_active: {
        Args: { _active: boolean; _entity: string; _id: string }
        Returns: undefined
      }
      advocate_conflicts: {
        Args: { _advocate: string }
        Returns: {
          booking_ref: string
          client_name: string
          id: string
          location_name: string
          problem: string
          starts_at: string
        }[]
      }
      appointment_by_token: {
        Args: { _token: string }
        Returns: {
          advocate_name: string
          booking_ref: string
          client_name: string
          ends_at: string
          location_address: string
          location_name: string
          service_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          timezone: string
        }[]
      }
      appointment_details_by_token: {
        Args: { _token: string }
        Returns: {
          advocate_name: string
          advocate_photo_url: string
          booking_ref: string
          client_name: string
          consultation_fee: number
          consultation_mode: string
          contact_email: string
          contact_phone: string
          ends_at: string
          location_address: string
          location_kind: string
          location_name: string
          service_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          timezone: string
        }[]
      }
      available_advocates: {
        Args: { _date: string; _duration: number; _location: string }
        Returns: {
          advocate_id: string
          first_slot: string
          slot_count: number
        }[]
      }
      available_slots: {
        Args: {
          _advocate: string
          _date: string
          _duration: number
          _location: string
        }
        Returns: {
          starts_at: string
        }[]
      }
      booking_advocate_options: {
        Args: {
          _date: string
          _hold_token?: string
          _location: string
          _month: string
          _service: string
          _start: string
          _zone: string
        }
        Returns: {
          advocate_id: string
          first_slot: string
          slot_count: number
        }[]
      }
      booking_day_slots: {
        Args: {
          _advocate: string
          _date: string
          _location: string
          _service: string
          _zone: string
        }
        Returns: {
          starts_at: string
        }[]
      }
      booking_month_availability: {
        Args: {
          _advocate: string
          _location: string
          _month: string
          _service: string
          _zone: string
        }
        Returns: {
          date: string
          slot_count: number
        }[]
      }
      can_manage_directory: { Args: { _user_id: string }; Returns: boolean }
      create_public_booking: {
        Args: {
          _advocate: string
          _client_key: string
          _consent: boolean
          _email: string
          _location: string
          _matter: string
          _name: string
          _opposing: string
          _phone: string
          _service: string
          _start: string
        }
        Returns: {
          access_token: string
          appointment_id: string
          booking_ref: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_firm_staff: { Args: { _user_id: string }; Returns: boolean }
      is_own_advocate: { Args: { _advocate_id: string }; Returns: boolean }
      revoke_user_sessions: { Args: { _user: string }; Returns: undefined }
      slot_problem: {
        Args: {
          _advocate: string
          _end: string
          _exclude?: string
          _location: string
          _start: string
        }
        Returns: string
      }
      staff_account_ok: { Args: { _user_id: string }; Returns: boolean }
      staff_appointment_action: {
        Args: {
          _action: string
          _id: string
          _new_start?: string
          _reason?: string
        }
        Returns: undefined
      }
      staff_can_see: {
        Args: { _advocate: string; _location: string }
        Returns: boolean
      }
      submit_appointment_booking: {
        Args: {
          _advocate: string
          _client_key: string
          _consent: boolean
          _email: string
          _hold_token: string
          _location: string
          _mode: string
          _name: string
          _phone: string
          _service: string
          _start: string
        }
        Returns: {
          access_token: string
          appointment_id: string
          assigned_advocate_id: string
          booking_ref: string
          consultation_fee: number
        }[]
      }
      submit_held_booking: {
        Args: {
          _advocate: string
          _client_key: string
          _consent: boolean
          _email: string
          _hold_token: string
          _location: string
          _matter: string
          _name: string
          _opposing: string
          _phone: string
          _service: string
          _start: string
        }
        Returns: {
          access_token: string
          appointment_id: string
          booking_ref: string
        }[]
      }
      unique_hint: { Args: { _constraint: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "staff" | "advocate"
      appointment_status:
        | "awaiting_confirmation"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "declined"
        | "no_show"
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
      app_role: ["admin", "staff", "advocate"],
      appointment_status: [
        "awaiting_confirmation",
        "confirmed",
        "completed",
        "cancelled",
        "declined",
        "no_show",
      ],
    },
  },
} as const
