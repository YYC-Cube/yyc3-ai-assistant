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
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          theme_preference: 'cyan' | 'red' | 'dark'
          updated_at: string | null
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          theme_preference?: 'cyan' | 'red' | 'dark'
          updated_at?: string | null
        }
        Update: {
          id?: string
          username?: string | null
          avatar_url?: string | null
          theme_preference?: 'cyan' | 'red' | 'dark'
          updated_at?: string | null
        }
      }
      ai_configs: {
        Row: {
          id: string
          user_id: string
          name: string
          provider: string
          model: string
          base_url: string | null
          settings: Json // Stores temperature, top_p, etc.
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          provider: string
          model: string
          base_url?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          provider?: string
          model?: string
          base_url?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      workflows: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          definition: Json // The DAG structure (nodes, edges)
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          definition: Json
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          definition?: Json
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      workflow_runs: {
        Row: {
          id: string
          workflow_id: string
          user_id: string
          status: 'pending' | 'running' | 'completed' | 'failed'
          logs: Json // Execution logs
          started_at: string
          completed_at: string | null
          duration_ms: number | null
        }
        Insert: {
          id?: string
          workflow_id: string
          user_id: string
          status?: 'pending' | 'running' | 'completed' | 'failed'
          logs?: Json
          started_at?: string
          completed_at?: string | null
          duration_ms?: number | null
        }
        Update: {
          id?: string
          workflow_id?: string
          user_id?: string
          status?: 'pending' | 'running' | 'completed' | 'failed'
          logs?: Json
          started_at?: string
          completed_at?: string | null
          duration_ms?: number | null
        }
      }
    }
    Views: {
      [_: string]: never
    }
    Functions: {
      [_: string]: never
    }
    Enums: {
      [_: string]: never
    }
  }
}
