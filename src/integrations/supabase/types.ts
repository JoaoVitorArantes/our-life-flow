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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          institution: string | null
          is_active: boolean
          is_demo: boolean
          name: string
          owner_id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          institution?: string | null
          is_active?: boolean
          is_demo?: boolean
          name: string
          owner_id: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          institution?: string | null
          is_active?: boolean
          is_demo?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          closing_day: number | null
          created_at: string
          credit_limit: number
          due_day: number | null
          id: string
          institution: string | null
          is_active: boolean
          is_demo: boolean
          name: string
          owner_id: string
          payment_account_id: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          closing_day?: number | null
          created_at?: string
          credit_limit?: number
          due_day?: number | null
          id?: string
          institution?: string | null
          is_active?: boolean
          is_demo?: boolean
          name: string
          owner_id: string
          payment_account_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          closing_day?: number | null
          created_at?: string
          credit_limit?: number
          due_day?: number | null
          id?: string
          institution?: string | null
          is_active?: boolean
          is_demo?: boolean
          name?: string
          owner_id?: string
          payment_account_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["category_type"]
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type?: Database["public"]["Enums"]["category_type"]
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["category_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contexts: {
        Row: {
          color: string | null
          cover_image: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_demo: boolean
          location: string | null
          name: string
          owner_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["context_status"]
          type: Database["public"]["Enums"]["context_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          color?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          name: string
          owner_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["context_status"]
          type?: Database["public"]["Enums"]["context_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          color?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          name?: string
          owner_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["context_status"]
          type?: Database["public"]["Enums"]["context_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contexts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          context_id: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_demo: boolean
          location: string | null
          owner_id: string
          starts_at: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          context_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          owner_id: string
          starts_at: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          context_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          owner_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financings: {
        Row: {
          account_id: string | null
          category_id: string | null
          context_id: string | null
          created_at: string
          description: string | null
          due_day: number | null
          financed_amount: number
          id: string
          installment_amount: number
          interest_rate: number | null
          is_demo: boolean
          name: string
          owner_id: string
          start_date: string
          status: Database["public"]["Enums"]["obligation_status"]
          total_installments: number
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          context_id?: string | null
          created_at?: string
          description?: string | null
          due_day?: number | null
          financed_amount?: number
          id?: string
          installment_amount?: number
          interest_rate?: number | null
          is_demo?: boolean
          name: string
          owner_id: string
          start_date: string
          status?: Database["public"]["Enums"]["obligation_status"]
          total_installments?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          context_id?: string | null
          created_at?: string
          description?: string | null
          due_day?: number | null
          financed_amount?: number
          id?: string
          installment_amount?: number
          interest_rate?: number | null
          is_demo?: boolean
          name?: string
          owner_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["obligation_status"]
          total_installments?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financings_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          amount: number
          contribution_date: string
          created_at: string
          description: string | null
          goal_id: string
          id: string
          is_demo: boolean
          movement_type: Database["public"]["Enums"]["goal_movement_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          contribution_date?: string
          created_at?: string
          description?: string | null
          goal_id: string
          id?: string
          is_demo?: boolean
          movement_type?: Database["public"]["Enums"]["goal_movement_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          contribution_date?: string
          created_at?: string
          description?: string | null
          goal_id?: string
          id?: string
          is_demo?: boolean
          movement_type?: Database["public"]["Enums"]["goal_movement_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          context_id: string | null
          created_at: string
          current_amount: number
          description: string | null
          due_date: string | null
          id: string
          is_demo: boolean
          owner_id: string
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          context_id?: string | null
          created_at?: string
          current_amount?: number
          description?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean
          owner_id: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          context_id?: string | null
          created_at?: string
          current_amount?: number
          description?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean
          owner_id?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_plans: {
        Row: {
          account_id: string | null
          card_id: string | null
          category_id: string | null
          context_id: string | null
          created_at: string
          description: string
          id: string
          installment_amount: number
          is_demo: boolean
          notes: string | null
          owner_id: string
          start_date: string
          total_amount: number
          total_installments: number
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          card_id?: string | null
          category_id?: string | null
          context_id?: string | null
          created_at?: string
          description: string
          id?: string
          installment_amount?: number
          is_demo?: boolean
          notes?: string | null
          owner_id: string
          start_date: string
          total_amount?: number
          total_installments?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          card_id?: string | null
          category_id?: string | null
          context_id?: string | null
          created_at?: string
          description?: string
          id?: string
          installment_amount?: number
          is_demo?: boolean
          notes?: string | null
          owner_id?: string
          start_date?: string
          total_amount?: number
          total_installments?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          created_at: string
          current_installment: number
          id: string
          installment_amount: number
          start_date: string
          total_installments: number
          transaction_id: string
        }
        Insert: {
          created_at?: string
          current_installment?: number
          id?: string
          installment_amount: number
          start_date?: string
          total_installments: number
          transaction_id: string
        }
        Update: {
          created_at?: string
          current_installment?: number
          id?: string
          installment_amount?: number
          start_date?: string
          total_installments?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          account_id: string | null
          context_id: string | null
          created_at: string
          description: string | null
          due_day: number | null
          id: string
          installment_amount: number
          is_demo: boolean
          owner_id: string
          person_name: string
          start_date: string
          status: Database["public"]["Enums"]["obligation_status"]
          total_amount: number
          total_installments: number
          type: Database["public"]["Enums"]["loan_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          context_id?: string | null
          created_at?: string
          description?: string | null
          due_day?: number | null
          id?: string
          installment_amount?: number
          is_demo?: boolean
          owner_id: string
          person_name: string
          start_date: string
          status?: Database["public"]["Enums"]["obligation_status"]
          total_amount?: number
          total_installments?: number
          type?: Database["public"]["Enums"]["loan_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          context_id?: string | null
          created_at?: string
          description?: string | null
          due_day?: number | null
          id?: string
          installment_amount?: number
          is_demo?: boolean
          owner_id?: string
          person_name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["obligation_status"]
          total_amount?: number
          total_installments?: number
          type?: Database["public"]["Enums"]["loan_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string | null
          context_id: string | null
          created_at: string
          id: string
          is_demo: boolean
          owner_id: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          content?: string | null
          context_id?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          owner_id: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          content?: string | null
          context_id?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          owner_id?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          amount: number
          card_id: string | null
          category_id: string | null
          context_id: string | null
          created_at: string
          description: string
          due_day: number | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          is_active: boolean
          is_demo: boolean
          next_date: string | null
          owner_id: string
          start_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          card_id?: string | null
          category_id?: string | null
          context_id?: string | null
          created_at?: string
          description: string
          due_day?: number | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          is_active?: boolean
          is_demo?: boolean
          next_date?: string | null
          owner_id: string
          start_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          card_id?: string | null
          category_id?: string | null
          context_id?: string | null
          created_at?: string
          description?: string
          due_day?: number | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          is_active?: boolean
          is_demo?: boolean
          next_date?: string | null
          owner_id?: string
          start_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount: number
          created_at: string
          from_user_id: string
          id: string
          settled_at: string | null
          status: Database["public"]["Enums"]["settlement_status"]
          to_user_id: string
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_user_id: string
          id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          to_user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_user_id?: string
          id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          to_user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          context_id: string | null
          created_at: string
          due_date: string | null
          id: string
          is_demo: boolean
          notes: string | null
          owner_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          context_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          owner_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          context_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          owner_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_splits: {
        Row: {
          amount: number
          created_at: string
          id: string
          percentage: number | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          percentage?: number | null
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          percentage?: number | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          card_id: string | null
          category_id: string | null
          context_id: string | null
          created_at: string
          description: string
          destination_account_id: string | null
          due_date: string | null
          financing_id: string | null
          id: string
          installment_number: number | null
          installment_plan_id: string | null
          is_demo: boolean
          is_shared: boolean
          loan_id: string | null
          notes: string | null
          owner_id: string
          paid_at: string | null
          recurring_id: string | null
          source_account_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          card_id?: string | null
          category_id?: string | null
          context_id?: string | null
          created_at?: string
          description: string
          destination_account_id?: string | null
          due_date?: string | null
          financing_id?: string | null
          id?: string
          installment_number?: number | null
          installment_plan_id?: string | null
          is_demo?: boolean
          is_shared?: boolean
          loan_id?: string | null
          notes?: string | null
          owner_id: string
          paid_at?: string | null
          recurring_id?: string | null
          source_account_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          card_id?: string | null
          category_id?: string | null
          context_id?: string | null
          created_at?: string
          description?: string
          destination_account_id?: string | null
          due_date?: string | null
          financing_id?: string | null
          id?: string
          installment_number?: number | null
          installment_plan_id?: string | null
          is_demo?: boolean
          is_shared?: boolean
          loan_id?: string | null
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          recurring_id?: string | null
          source_account_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_financing_id_fkey"
            columns: ["financing_id"]
            isOneToOne: false
            referencedRelation: "financings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_installment_plan_id_fkey"
            columns: ["installment_plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_account: { Args: { _name?: string }; Returns: string }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
      is_workspace_owner: { Args: { _workspace_id: string }; Returns: boolean }
      user_is_workspace_member: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "CHECKING" | "SAVINGS" | "CASH" | "INVESTMENT" | "OTHER"
      category_type: "INCOME" | "EXPENSE" | "BOTH"
      context_status: "PLANNED" | "ACTIVE" | "COMPLETED" | "ARCHIVED"
      context_type:
        | "EVENT"
        | "TRIP"
        | "PROJECT"
        | "COLLEGE"
        | "PERSONAL"
        | "COUPLE"
        | "OTHER"
      goal_movement_type: "CONTRIBUTION" | "WITHDRAWAL"
      goal_status: "ACTIVE" | "PAUSED" | "DONE"
      loan_type: "LENT" | "BORROWED"
      member_role: "OWNER" | "MEMBER"
      obligation_status: "ACTIVE" | "COMPLETED" | "CANCELLED"
      payment_status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED"
      recurrence_frequency: "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM"
      settlement_status: "PENDING" | "SETTLED" | "CANCELLED"
      task_status: "TODO" | "DOING" | "DONE"
      transaction_type: "INCOME" | "EXPENSE" | "TRANSFER"
      visibility: "PRIVATE" | "SHARED"
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
      account_type: ["CHECKING", "SAVINGS", "CASH", "INVESTMENT", "OTHER"],
      category_type: ["INCOME", "EXPENSE", "BOTH"],
      context_status: ["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"],
      context_type: [
        "EVENT",
        "TRIP",
        "PROJECT",
        "COLLEGE",
        "PERSONAL",
        "COUPLE",
        "OTHER",
      ],
      goal_movement_type: ["CONTRIBUTION", "WITHDRAWAL"],
      goal_status: ["ACTIVE", "PAUSED", "DONE"],
      loan_type: ["LENT", "BORROWED"],
      member_role: ["OWNER", "MEMBER"],
      obligation_status: ["ACTIVE", "COMPLETED", "CANCELLED"],
      payment_status: ["PENDING", "PAID", "OVERDUE", "CANCELLED"],
      recurrence_frequency: ["WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"],
      settlement_status: ["PENDING", "SETTLED", "CANCELLED"],
      task_status: ["TODO", "DOING", "DONE"],
      transaction_type: ["INCOME", "EXPENSE", "TRANSFER"],
      visibility: ["PRIVATE", "SHARED"],
    },
  },
} as const
