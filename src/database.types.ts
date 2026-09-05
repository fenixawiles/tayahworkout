// Generated-shape Supabase types. Regenerate after schema changes with:
// supabase gen types typescript --local > src/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Category = 'strength' | 'bodyweight' | 'cardio' | 'mobility' | 'recovery'
type BodyArea = 'upper-body' | 'lower-body' | 'core' | 'full-body'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; time_zone: string; username: string | null; friend_code: string; username_changed_at: string | null; timezone_changed_at: string | null; created_at: string; updated_at: string }
        Insert: { id: string; display_name: string; time_zone?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; display_name?: string; time_zone?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      exercises: {
        Row: { id: string; owner_id: string | null; name: string; category: Category; body_area: BodyArea; equipment: string; default_target: string; image_path: string | null; image_source: string | null; archived_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; owner_id?: string | null; name: string; category: Category; body_area?: BodyArea; equipment?: string; default_target?: string; image_path?: string | null; image_source?: string | null; archived_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; owner_id?: string | null; name?: string; category?: Category; body_area?: BodyArea; equipment?: string; default_target?: string; image_path?: string | null; image_source?: string | null; archived_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      exercise_favorites: {
        Row: { user_id: string; exercise_id: string; created_at: string }
        Insert: { user_id: string; exercise_id: string; created_at?: string }
        Update: { user_id?: string; exercise_id?: string; created_at?: string }
        Relationships: [{ foreignKeyName: 'exercise_favorites_exercise_id_fkey'; columns: ['exercise_id']; isOneToOne: false; referencedRelation: 'exercises'; referencedColumns: ['id'] }]
      }
      exercise_preferences: {
        Row: { user_id: string; exercise_id: string; target: string; weight: number | null; weight_unit: 'lb' | 'kg'; updated_at: string }
        Insert: { user_id: string; exercise_id: string; target?: string; weight?: number | null; weight_unit?: 'lb' | 'kg'; updated_at?: string }
        Update: { user_id?: string; exercise_id?: string; target?: string; weight?: number | null; weight_unit?: 'lb' | 'kg'; updated_at?: string }
        Relationships: [{ foreignKeyName: 'exercise_preferences_exercise_id_fkey'; columns: ['exercise_id']; isOneToOne: false; referencedRelation: 'exercises'; referencedColumns: ['id'] }]
      }
      day_plans: {
        Row: { id: string; user_id: string; plan_date: string; title: string; reflection: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; plan_date: string; title?: string; reflection?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; plan_date?: string; title?: string; reflection?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      day_exercises: {
        Row: { id: string; day_plan_id: string; source_exercise_id: string | null; name_snapshot: string; category: Category; body_area_snapshot: BodyArea; image_path_snapshot: string | null; target: string; notes: string; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; day_plan_id: string; source_exercise_id?: string | null; name_snapshot: string; category: Category; body_area_snapshot?: BodyArea; image_path_snapshot?: string | null; target?: string; notes?: string; sort_order: number; created_at?: string; updated_at?: string }
        Update: { id?: string; day_plan_id?: string; source_exercise_id?: string | null; name_snapshot?: string; category?: Category; body_area_snapshot?: BodyArea; image_path_snapshot?: string | null; target?: string; notes?: string; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: 'day_exercises_day_plan_id_fkey'; columns: ['day_plan_id']; isOneToOne: false; referencedRelation: 'day_plans'; referencedColumns: ['id'] },
          { foreignKeyName: 'day_exercises_source_exercise_id_fkey'; columns: ['source_exercise_id']; isOneToOne: false; referencedRelation: 'exercises'; referencedColumns: ['id'] },
        ]
      }
      exercise_completions: {
        Row: { day_exercise_id: string; completed_at: string }
        Insert: { day_exercise_id: string; completed_at?: string }
        Update: { day_exercise_id?: string; completed_at?: string }
        Relationships: [{ foreignKeyName: 'exercise_completions_day_exercise_id_fkey'; columns: ['day_exercise_id']; isOneToOne: true; referencedRelation: 'day_exercises'; referencedColumns: ['id'] }]
      }
      routine_templates: {
        Row: { id: string; user_id: string; name: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; name: string; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; name?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      routine_template_items: {
        Row: { id: string; routine_template_id: string; source_exercise_id: string | null; name_snapshot: string; category: Category; body_area_snapshot: BodyArea; image_path_snapshot: string | null; target: string; notes: string; sort_order: number }
        Insert: { id?: string; routine_template_id: string; source_exercise_id?: string | null; name_snapshot: string; category: Category; body_area_snapshot?: BodyArea; image_path_snapshot?: string | null; target?: string; notes?: string; sort_order: number }
        Update: { id?: string; routine_template_id?: string; source_exercise_id?: string | null; name_snapshot?: string; category?: Category; body_area_snapshot?: BodyArea; image_path_snapshot?: string | null; target?: string; notes?: string; sort_order?: number }
        Relationships: [
          { foreignKeyName: 'routine_template_items_routine_template_id_fkey'; columns: ['routine_template_id']; isOneToOne: false; referencedRelation: 'routine_templates'; referencedColumns: ['id'] },
          { foreignKeyName: 'routine_template_items_source_exercise_id_fkey'; columns: ['source_exercise_id']; isOneToOne: false; referencedRelation: 'exercises'; referencedColumns: ['id'] },
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      current_user_date: { Args: { p_user_id?: string }; Returns: string }
      save_day_plan: { Args: { p_plan_date: string; p_title: string; p_items: Json }; Returns: string }
      set_exercise_completion: { Args: { p_day_exercise_id: string; p_completed: boolean }; Returns: undefined }
      save_day_reflection: { Args: { p_plan_date: string; p_reflection: string }; Returns: undefined }
      save_routine_template: { Args: { p_name: string; p_items: Json }; Returns: string }
      update_profile: { Args: { p_display_name: string; p_time_zone: string; p_username: string }; Returns: undefined }
      get_community: { Args: Record<string, never>; Returns: Json }
      find_friend: { Args: { p_query: string }; Returns: Json }
      send_friend_request: { Args: { p_user_id: string }; Returns: undefined }
      respond_friend_request: { Args: { p_request_id: string; p_action: string }; Returns: undefined }
      set_user_block: { Args: { p_user_id: string; p_blocked: boolean }; Returns: undefined }
      report_user: { Args: { p_user_id: string; p_reason: string; p_details: string; p_block?: boolean }; Returns: string }
      create_competition: { Args: { p_friend_id: string; p_title: string; p_starts_on: string; p_days: number }; Returns: string }
      respond_competition: { Args: { p_competition_id: string; p_action: string }; Returns: undefined }
      submit_support_request: { Args: { p_kind: string; p_details: string }; Returns: string }
      cancel_support_request: { Args: { p_id: string }; Returns: undefined }
      get_moderation_queue: { Args: Record<string, never>; Returns: Json }
      review_community_case: { Args: { p_id: string; p_kind: string; p_status: string; p_response: string; p_restrict?: boolean }; Returns: undefined }
      get_account_settings: { Args: Record<string, never>; Returns: Json }
      set_workout_reminder: { Args: { p_enabled: boolean }; Returns: undefined }
    }
    Enums: { exercise_category: Category; body_area: BodyArea }
    CompositeTypes: Record<never, never>
  }
}
