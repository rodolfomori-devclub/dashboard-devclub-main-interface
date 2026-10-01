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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
          user_name: string
          user_role: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id: string
          user_name?: string
          user_role?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
          user_name?: string
          user_role?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      call_analysis: {
        Row: {
          analysis_json: Json
          analyzed_at: string
          call_id: string
          closing_quality: string
          coaching_feedback: string
          created_at: string
          id: string
          lead_context: string
          model: string
          next_steps: Json
          objections: Json
          pain_points: Json
          playbook_adherence: Json
          playbook_id: string | null
          summary: string
          updated_at: string
          what_didnt_work: Json
          what_worked: Json
        }
        Insert: {
          analysis_json?: Json
          analyzed_at?: string
          call_id: string
          closing_quality?: string
          coaching_feedback?: string
          created_at?: string
          id?: string
          lead_context?: string
          model?: string
          next_steps?: Json
          objections?: Json
          pain_points?: Json
          playbook_adherence?: Json
          playbook_id?: string | null
          summary?: string
          updated_at?: string
          what_didnt_work?: Json
          what_worked?: Json
        }
        Update: {
          analysis_json?: Json
          analyzed_at?: string
          call_id?: string
          closing_quality?: string
          coaching_feedback?: string
          created_at?: string
          id?: string
          lead_context?: string
          model?: string
          next_steps?: Json
          objections?: Json
          pain_points?: Json
          playbook_adherence?: Json
          playbook_id?: string | null
          summary?: string
          updated_at?: string
          what_didnt_work?: Json
          what_worked?: Json
        }
        Relationships: [
          {
            foreignKeyName: "call_analysis_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "call_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analysis_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "call_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      call_objections: {
        Row: {
          call_id: string
          created_at: string
          id: string
          quote: string
          severity: string
          type: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          quote?: string
          severity?: string
          type?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          quote?: string
          severity?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_objections_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_records"
            referencedColumns: ["id"]
          },
        ]
      }
      call_playbooks: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          steps: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          steps?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          steps?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      call_records: {
        Row: {
          call_date: string | null
          created_at: string
          google_doc_id: string
          google_doc_url: string
          id: string
          import_error: string
          import_status: string
          lead_name: string
          product: string
          raw_filename: string
          seller_id: string | null
          seller_name: string
          source_id: string | null
          transcript_text: string
          updated_at: string
          video_url: string
        }
        Insert: {
          call_date?: string | null
          created_at?: string
          google_doc_id: string
          google_doc_url?: string
          id?: string
          import_error?: string
          import_status?: string
          lead_name?: string
          product?: string
          raw_filename?: string
          seller_id?: string | null
          seller_name?: string
          source_id?: string | null
          transcript_text?: string
          updated_at?: string
          video_url?: string
        }
        Update: {
          call_date?: string | null
          created_at?: string
          google_doc_id?: string
          google_doc_url?: string
          id?: string
          import_error?: string
          import_status?: string
          lead_name?: string
          product?: string
          raw_filename?: string
          seller_id?: string | null
          seller_name?: string
          source_id?: string | null
          transcript_text?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      call_scores: {
        Row: {
          call_id: string
          closing: number
          created_at: string
          diagnosis: number
          id: string
          objection_handling: number
          offer: number
          opening: number
          pain_desire: number
          total: number
        }
        Insert: {
          call_id: string
          closing?: number
          created_at?: string
          diagnosis?: number
          id?: string
          objection_handling?: number
          offer?: number
          opening?: number
          pain_desire?: number
          total?: number
        }
        Update: {
          call_id?: string
          closing?: number
          created_at?: string
          diagnosis?: number
          id?: string
          objection_handling?: number
          offer?: number
          opening?: number
          pain_desire?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "call_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "call_records"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sync_sources: {
        Row: {
          active: boolean
          created_at: string
          files_found: number
          files_imported: number
          files_skipped: number
          folder_id: string
          folder_url: string
          id: string
          last_error: string
          last_status: string
          last_synced_at: string | null
          seller_id: string
          seller_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          files_found?: number
          files_imported?: number
          files_skipped?: number
          folder_id?: string
          folder_url?: string
          id?: string
          last_error?: string
          last_status?: string
          last_synced_at?: string | null
          seller_id: string
          seller_name?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          files_found?: number
          files_imported?: number
          files_skipped?: number
          folder_id?: string
          folder_url?: string
          id?: string
          last_error?: string
          last_status?: string
          last_synced_at?: string | null
          seller_id?: string
          seller_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_installments: {
        Row: {
          commission_percentage: number
          commission_value: number
          created_at: string
          expected_month: number
          expected_year: number
          id: string
          installment_amount: number
          installment_number: number
          marked_paid_at: string | null
          marked_paid_note: string
          original_sale_value: number
          platform: string
          product: string
          sale_id: string
          seller_id: string
          status: string
          total_installments: number
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          commission_percentage?: number
          commission_value?: number
          created_at?: string
          expected_month: number
          expected_year: number
          id?: string
          installment_amount?: number
          installment_number: number
          marked_paid_at?: string | null
          marked_paid_note?: string
          original_sale_value?: number
          platform?: string
          product?: string
          sale_id: string
          seller_id: string
          status?: string
          total_installments: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          commission_percentage?: number
          commission_value?: number
          created_at?: string
          expected_month?: number
          expected_year?: number
          id?: string
          installment_amount?: number
          installment_number?: number
          marked_paid_at?: string | null
          marked_paid_note?: string
          original_sale_value?: number
          platform?: string
          product?: string
          sale_id?: string
          seller_id?: string
          status?: string
          total_installments?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      commission_observations: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          month: number
          seller_id: string
          type: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          month: number
          seller_id: string
          type?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          month?: number
          seller_id?: string
          type?: string
          year?: number
        }
        Relationships: []
      }
      commission_reports: {
        Row: {
          created_at: string
          fixed_salary: number
          id: string
          manager_notes: string
          month: number
          seller_id: string
          seller_name: string
          seller_notes: string
          status: string
          submitted_at: string
          total_bonuses: number
          total_commission: number
          total_payment: number
          total_sales: number
          year: number
        }
        Insert: {
          created_at?: string
          fixed_salary?: number
          id?: string
          manager_notes?: string
          month: number
          seller_id: string
          seller_name?: string
          seller_notes?: string
          status?: string
          submitted_at?: string
          total_bonuses?: number
          total_commission?: number
          total_payment?: number
          total_sales?: number
          year: number
        }
        Update: {
          created_at?: string
          fixed_salary?: number
          id?: string
          manager_notes?: string
          month?: number
          seller_id?: string
          seller_name?: string
          seller_notes?: string
          status?: string
          submitted_at?: string
          total_bonuses?: number
          total_commission?: number
          total_payment?: number
          total_sales?: number
          year?: number
        }
        Relationships: []
      }
      content_distribution_daily: {
        Row: {
          amount_spent: number
          created_at: string
          day: string
          id: string
          imported_at: string
          impressions: number
        }
        Insert: {
          amount_spent?: number
          created_at?: string
          day: string
          id?: string
          imported_at?: string
          impressions?: number
        }
        Update: {
          amount_spent?: number
          created_at?: string
          day?: string
          id?: string
          imported_at?: string
          impressions?: number
        }
        Relationships: []
      }
      content_distribution_items: {
        Row: {
          amount_spent: number
          content: string
          cost_per_follower: number
          cost_per_visit: number
          created_at: string
          current_gain: number
          followers: number
          format: string
          id: string
          imported_at: string
          monthly_cps: number
          monthly_investment: number
          status: string
          total_followers: number
          visits: number
        }
        Insert: {
          amount_spent?: number
          content?: string
          cost_per_follower?: number
          cost_per_visit?: number
          created_at?: string
          current_gain?: number
          followers?: number
          format?: string
          id?: string
          imported_at?: string
          monthly_cps?: number
          monthly_investment?: number
          status?: string
          total_followers?: number
          visits?: number
        }
        Update: {
          amount_spent?: number
          content?: string
          cost_per_follower?: number
          cost_per_visit?: number
          created_at?: string
          current_gain?: number
          followers?: number
          format?: string
          id?: string
          imported_at?: string
          monthly_cps?: number
          monthly_investment?: number
          status?: string
          total_followers?: number
          visits?: number
        }
        Relationships: []
      }
      content_distribution_settings: {
        Row: {
          id: string
          last_error: string
          last_row_count: number
          last_status: string
          last_synced_at: string | null
          sheet_url: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_error?: string
          last_row_count?: number
          last_status?: string
          last_synced_at?: string | null
          sheet_url?: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_error?: string
          last_row_count?: number
          last_status?: string
          last_synced_at?: string | null
          sheet_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_checklist: {
        Row: {
          completed_tasks: string[]
          created_at: string
          date: string
          id: string
          notes: string
          reminders: Json
          seller_id: string
          updated_at: string
        }
        Insert: {
          completed_tasks?: string[]
          created_at?: string
          date?: string
          id?: string
          notes?: string
          reminders?: Json
          seller_id: string
          updated_at?: string
        }
        Update: {
          completed_tasks?: string[]
          created_at?: string
          date?: string
          id?: string
          notes?: string
          reminders?: Json
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_kpis: {
        Row: {
          calls_completed: number
          calls_scheduled: number
          created_at: string
          date: string
          follows: number
          id: string
          leads: number
          leads_disqualified: number
          rejections: number
          sales: number
          sales_scheduled: number
          seller_id: string
          updated_at: string
        }
        Insert: {
          calls_completed?: number
          calls_scheduled?: number
          created_at?: string
          date: string
          follows?: number
          id?: string
          leads?: number
          leads_disqualified?: number
          rejections?: number
          sales?: number
          sales_scheduled?: number
          seller_id: string
          updated_at?: string
        }
        Update: {
          calls_completed?: number
          calls_scheduled?: number
          created_at?: string
          date?: string
          follows?: number
          id?: string
          leads?: number
          leads_disqualified?: number
          rejections?: number
          sales?: number
          sales_scheduled?: number
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_targets: {
        Row: {
          created_at: string
          daily_target_quality_meetings: number
          id: string
          target_calls_completed: number
          target_calls_scheduled: number
          target_leads_per_day: number
          target_sales_per_day: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_target_quality_meetings?: number
          id?: string
          target_calls_completed?: number
          target_calls_scheduled?: number
          target_leads_per_day?: number
          target_sales_per_day?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_target_quality_meetings?: number
          id?: string
          target_calls_completed?: number
          target_calls_scheduled?: number
          target_leads_per_day?: number
          target_sales_per_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      dre_global: {
        Row: {
          cc_hubla: number
          cc_tmb: number
          costs_comissoes: Json
          costs_ferramentas: Json
          costs_marketing: Json
          costs_time: Json
          created_at: string
          created_by: string | null
          id: string
          impostos: number
          locked: boolean
          month: number
          overhead_fixo: number
          revenue_hubla: number
          revenue_tmb: number
          updated_at: string
          year: number
        }
        Insert: {
          cc_hubla?: number
          cc_tmb?: number
          costs_comissoes?: Json
          costs_ferramentas?: Json
          costs_marketing?: Json
          costs_time?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          impostos?: number
          locked?: boolean
          month: number
          overhead_fixo?: number
          revenue_hubla?: number
          revenue_tmb?: number
          updated_at?: string
          year: number
        }
        Update: {
          cc_hubla?: number
          cc_tmb?: number
          costs_comissoes?: Json
          costs_ferramentas?: Json
          costs_marketing?: Json
          costs_time?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          impostos?: number
          locked?: boolean
          month?: number
          overhead_fixo?: number
          revenue_hubla?: number
          revenue_tmb?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          date: string
          description: string
          end_time: string | null
          id: string
          meeting_url: string
          organizer: string
          product: string
          recurrence: string
          recurrence_end_date: string | null
          recurrence_interval: number
          start_time: string
          title: string
          updated_at: string
          visibility: string
          visibility_user_ids: string[]
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          date: string
          description?: string
          end_time?: string | null
          id?: string
          meeting_url?: string
          organizer?: string
          product?: string
          recurrence?: string
          recurrence_end_date?: string | null
          recurrence_interval?: number
          start_time: string
          title: string
          updated_at?: string
          visibility?: string
          visibility_user_ids?: string[]
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          end_time?: string | null
          id?: string
          meeting_url?: string
          organizer?: string
          product?: string
          recurrence?: string
          recurrence_end_date?: string | null
          recurrence_interval?: number
          start_time?: string
          title?: string
          updated_at?: string
          visibility?: string
          visibility_user_ids?: string[]
        }
        Relationships: []
      }
      financial_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          report_id: string | null
          seller_id: string
          seller_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          report_id?: string | null
          seller_id: string
          seller_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          report_id?: string | null
          seller_id?: string
          seller_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "commission_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          created_at: string
          description: string
          id: string
          lead_id: string
          metadata: Json
          type: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          lead_id: string
          metadata?: Json
          type: string
          user_id?: string | null
          user_name?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          metadata?: Json
          type?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          lead_id: string
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          lead_id: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          contact: string
          converted_sale_id: string | null
          created_at: string
          email: string
          id: string
          income_range: string
          last_activity_at: string
          linkedin: string
          name: string
          notes: string
          pipeline_id: string | null
          potential_value: number
          product_interest: string
          seller_id: string
          source: string
          stage_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[]
          temperature: string
          updated_at: string
          utm: string
          whatsapp: string
        }
        Insert: {
          assigned_to?: string | null
          contact?: string
          converted_sale_id?: string | null
          created_at?: string
          email?: string
          id?: string
          income_range?: string
          last_activity_at?: string
          linkedin?: string
          name: string
          notes?: string
          pipeline_id?: string | null
          potential_value?: number
          product_interest?: string
          seller_id: string
          source?: string
          stage_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          temperature?: string
          updated_at?: string
          utm?: string
          whatsapp?: string
        }
        Update: {
          assigned_to?: string | null
          contact?: string
          converted_sale_id?: string | null
          created_at?: string
          email?: string
          id?: string
          income_range?: string
          last_activity_at?: string
          linkedin?: string
          name?: string
          notes?: string
          pipeline_id?: string | null
          potential_value?: number
          product_interest?: string
          seller_id?: string
          source?: string
          stage_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          temperature?: string
          updated_at?: string
          utm?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      low_ticket_devclub_ads: {
        Row: {
          ad_name: string
          ad_set_name: string
          amount_spent: number
          checkouts_initiated: number
          created_at: string
          creative_permalink: string
          day: string | null
          frequency: number
          id: string
          imported_at: string
          impressions: number
          landing_page_views: number
          link_clicks: number
          purchases: number
          raw: Json
          source_sheet: string
        }
        Insert: {
          ad_name?: string
          ad_set_name?: string
          amount_spent?: number
          checkouts_initiated?: number
          created_at?: string
          creative_permalink?: string
          day?: string | null
          frequency?: number
          id?: string
          imported_at?: string
          impressions?: number
          landing_page_views?: number
          link_clicks?: number
          purchases?: number
          raw?: Json
          source_sheet?: string
        }
        Update: {
          ad_name?: string
          ad_set_name?: string
          amount_spent?: number
          checkouts_initiated?: number
          created_at?: string
          creative_permalink?: string
          day?: string | null
          frequency?: number
          id?: string
          imported_at?: string
          impressions?: number
          landing_page_views?: number
          link_clicks?: number
          purchases?: number
          raw?: Json
          source_sheet?: string
        }
        Relationships: []
      }
      low_ticket_devclub_kpis: {
        Row: {
          checkout_sobre_pageview: number
          cliques: number
          connect_rate: number
          conversao_checkout: number
          conversao_pagina_geral: number
          conversao_pagina_trafego: number
          cpa: number
          cpa_real: number
          cpc: number
          cpm: number
          created_at: string
          ctr: number
          custo_pageview: number
          custo_por_checkout: number
          day: string | null
          id: string
          imported_at: string
          impressoes: number
          lucro: number
          lucro_bruto: number
          mes: string
          num_checkout: number
          observacoes: string
          pageview: number
          raw: Json
          roas: number
          solo_r17: number
          source_sheet: string
          ticket_medio: number
          total_em_vendas: number
          valor_gasto: number
          vendas_qtd: number
        }
        Insert: {
          checkout_sobre_pageview?: number
          cliques?: number
          connect_rate?: number
          conversao_checkout?: number
          conversao_pagina_geral?: number
          conversao_pagina_trafego?: number
          cpa?: number
          cpa_real?: number
          cpc?: number
          cpm?: number
          created_at?: string
          ctr?: number
          custo_pageview?: number
          custo_por_checkout?: number
          day?: string | null
          id?: string
          imported_at?: string
          impressoes?: number
          lucro?: number
          lucro_bruto?: number
          mes?: string
          num_checkout?: number
          observacoes?: string
          pageview?: number
          raw?: Json
          roas?: number
          solo_r17?: number
          source_sheet?: string
          ticket_medio?: number
          total_em_vendas?: number
          valor_gasto?: number
          vendas_qtd?: number
        }
        Update: {
          checkout_sobre_pageview?: number
          cliques?: number
          connect_rate?: number
          conversao_checkout?: number
          conversao_pagina_geral?: number
          conversao_pagina_trafego?: number
          cpa?: number
          cpa_real?: number
          cpc?: number
          cpm?: number
          created_at?: string
          ctr?: number
          custo_pageview?: number
          custo_por_checkout?: number
          day?: string | null
          id?: string
          imported_at?: string
          impressoes?: number
          lucro?: number
          lucro_bruto?: number
          mes?: string
          num_checkout?: number
          observacoes?: string
          pageview?: number
          raw?: Json
          roas?: number
          solo_r17?: number
          source_sheet?: string
          ticket_medio?: number
          total_em_vendas?: number
          valor_gasto?: number
          vendas_qtd?: number
        }
        Relationships: []
      }
      low_ticket_devclub_purchases: {
        Row: {
          created_at: string
          customer: string
          id: string
          imported_at: string
          installments: number
          origin: string
          platform: string
          product: string
          purchase_amount: number
          purchase_date: string | null
          raw: Json
          revenue: number
          source_sheet: string
          status: string
        }
        Insert: {
          created_at?: string
          customer?: string
          id?: string
          imported_at?: string
          installments?: number
          origin?: string
          platform?: string
          product?: string
          purchase_amount?: number
          purchase_date?: string | null
          raw?: Json
          revenue?: number
          source_sheet?: string
          status?: string
        }
        Update: {
          created_at?: string
          customer?: string
          id?: string
          imported_at?: string
          installments?: number
          origin?: string
          platform?: string
          product?: string
          purchase_amount?: number
          purchase_date?: string | null
          raw?: Json
          revenue?: number
          source_sheet?: string
          status?: string
        }
        Relationships: []
      }
      low_ticket_devclub_settings: {
        Row: {
          id: string
          last_error: string
          last_row_count: number
          last_status: string
          last_synced_at: string | null
          sheet_url: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_error?: string
          last_row_count?: number
          last_status?: string
          last_synced_at?: string | null
          sheet_url?: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_error?: string
          last_row_count?: number
          last_status?: string
          last_synced_at?: string | null
          sheet_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      manager_notes: {
        Row: {
          content: string
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_data: {
        Row: {
          campaign_name: string
          created_at: string
          date: string
          id: string
          imported_at: string
          imported_by: string | null
          leads: number
          mqls: number
          platform: string
          source_name: string
          spend: number
        }
        Insert: {
          campaign_name?: string
          created_at?: string
          date: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          leads?: number
          mqls?: number
          platform?: string
          source_name?: string
          spend?: number
        }
        Update: {
          campaign_name?: string
          created_at?: string
          date?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          leads?: number
          mqls?: number
          platform?: string
          source_name?: string
          spend?: number
        }
        Relationships: []
      }
      marketing_goals: {
        Row: {
          budget: number
          created_at: string
          id: string
          lead_goal: number
          month: number
          mql_goal: number
          updated_at: string
          year: number
        }
        Insert: {
          budget?: number
          created_at?: string
          id?: string
          lead_goal?: number
          month: number
          mql_goal?: number
          updated_at?: string
          year: number
        }
        Update: {
          budget?: number
          created_at?: string
          id?: string
          lead_goal?: number
          month?: number
          mql_goal?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      marketing_settings: {
        Row: {
          id: string
          last_error: string
          last_row_count: number
          last_status: string
          last_synced_at: string | null
          sheet_url: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_error?: string
          last_row_count?: number
          last_status?: string
          last_synced_at?: string | null
          sheet_url?: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_error?: string
          last_row_count?: number
          last_status?: string
          last_synced_at?: string | null
          sheet_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          title: string
          type: string
          url: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          id?: string
          title: string
          type?: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          title?: string
          type?: string
          url?: string
        }
        Relationships: []
      }
      meeting_evaluations: {
        Row: {
          attendance_status: string
          clear_pain_point: boolean
          created_at: string
          currently_employed: boolean
          evaluated_by: string | null
          evaluated_by_name: string
          evaluation_date: string
          high_priority: boolean
          id: string
          meeting_id: string
          qualification_accurate: boolean
          quality_score: number
          rescheduled_meeting_id: string | null
          rescheduled_to_date: string | null
          rescheduled_to_time: string | null
          updated_at: string
          watched_materials: boolean
        }
        Insert: {
          attendance_status?: string
          clear_pain_point?: boolean
          created_at?: string
          currently_employed?: boolean
          evaluated_by?: string | null
          evaluated_by_name?: string
          evaluation_date?: string
          high_priority?: boolean
          id?: string
          meeting_id: string
          qualification_accurate?: boolean
          quality_score?: number
          rescheduled_meeting_id?: string | null
          rescheduled_to_date?: string | null
          rescheduled_to_time?: string | null
          updated_at?: string
          watched_materials?: boolean
        }
        Update: {
          attendance_status?: string
          clear_pain_point?: boolean
          created_at?: string
          currently_employed?: boolean
          evaluated_by?: string | null
          evaluated_by_name?: string
          evaluation_date?: string
          high_priority?: boolean
          id?: string
          meeting_id?: string
          qualification_accurate?: boolean
          quality_score?: number
          rescheduled_meeting_id?: string | null
          rescheduled_to_date?: string | null
          rescheduled_to_time?: string | null
          updated_at?: string
          watched_materials?: boolean
        }
        Relationships: []
      }
      meeting_pain_clusters: {
        Row: {
          computed_at: string
          id: string
          meeting_count: number
          result: Json
        }
        Insert: {
          computed_at?: string
          id?: string
          meeting_count?: number
          result?: Json
        }
        Update: {
          computed_at?: string
          id?: string
          meeting_count?: number
          result?: Json
        }
        Relationships: []
      }
      meetings: {
        Row: {
          already_tried_global: string
          assigned_closer_id: string | null
          assigned_closer_name: string
          calendar_event_id: string
          call_analysis_id: string | null
          can_invest: string | null
          career_priority: string
          created_at: string
          crm_lead_id: string | null
          currently_employed: string
          funnel_entry: string
          has_college_degree: string
          has_degree: string
          id: string
          is_priority: string
          lead_name: string
          linkedin_profile: string
          main_pain_point: string
          meeting_date: string | null
          meeting_time: string | null
          notes: string
          priority: string
          product: string
          recording_url: string
          scheduled_at: string
          scheduled_by: string | null
          scheduled_by_name: string
          seniority: string
          source: string
          status: string
          team_id: string | null
          updated_at: string
          watched_materials: string
          watched_recorded_materials: string
          whatsapp: string
          would_invest_500_plus: string
        }
        Insert: {
          already_tried_global?: string
          assigned_closer_id?: string | null
          assigned_closer_name?: string
          calendar_event_id?: string
          call_analysis_id?: string | null
          can_invest?: string | null
          career_priority?: string
          created_at?: string
          crm_lead_id?: string | null
          currently_employed?: string
          funnel_entry?: string
          has_college_degree?: string
          has_degree?: string
          id?: string
          is_priority?: string
          lead_name?: string
          linkedin_profile?: string
          main_pain_point?: string
          meeting_date?: string | null
          meeting_time?: string | null
          notes?: string
          priority?: string
          product?: string
          recording_url?: string
          scheduled_at?: string
          scheduled_by?: string | null
          scheduled_by_name?: string
          seniority?: string
          source?: string
          status?: string
          team_id?: string | null
          updated_at?: string
          watched_materials?: string
          watched_recorded_materials?: string
          whatsapp?: string
          would_invest_500_plus?: string
        }
        Update: {
          already_tried_global?: string
          assigned_closer_id?: string | null
          assigned_closer_name?: string
          calendar_event_id?: string
          call_analysis_id?: string | null
          can_invest?: string | null
          career_priority?: string
          created_at?: string
          crm_lead_id?: string | null
          currently_employed?: string
          funnel_entry?: string
          has_college_degree?: string
          has_degree?: string
          id?: string
          is_priority?: string
          lead_name?: string
          linkedin_profile?: string
          main_pain_point?: string
          meeting_date?: string | null
          meeting_time?: string | null
          notes?: string
          priority?: string
          product?: string
          recording_url?: string
          scheduled_at?: string
          scheduled_by?: string | null
          scheduled_by_name?: string
          seniority?: string
          source?: string
          status?: string
          team_id?: string | null
          updated_at?: string
          watched_materials?: string
          watched_recorded_materials?: string
          whatsapp?: string
          would_invest_500_plus?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          cash_collected_target: number
          created_at: string
          created_by: string | null
          daily_goal: number
          daily_hyper_goal: number
          daily_special_bonus_threshold: number
          id: string
          month: number
          monthly_hyper_goal: number
          team_goal: number
          updated_at: string
          weekly_goal: number
          weekly_hyper_goal: number
          year: number
        }
        Insert: {
          cash_collected_target?: number
          created_at?: string
          created_by?: string | null
          daily_goal?: number
          daily_hyper_goal?: number
          daily_special_bonus_threshold?: number
          id?: string
          month: number
          monthly_hyper_goal?: number
          team_goal?: number
          updated_at?: string
          weekly_goal?: number
          weekly_hyper_goal?: number
          year: number
        }
        Update: {
          cash_collected_target?: number
          created_at?: string
          created_by?: string | null
          daily_goal?: number
          daily_hyper_goal?: number
          daily_special_bonus_threshold?: number
          id?: string
          month?: number
          monthly_hyper_goal?: number
          team_goal?: number
          updated_at?: string
          weekly_goal?: number
          weekly_hyper_goal?: number
          year?: number
        }
        Relationships: []
      }
      monthly_income: {
        Row: {
          created_at: string
          fixed_salary: number
          id: string
          month: number
          seller_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          fixed_salary?: number
          id?: string
          month: number
          seller_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          fixed_salary?: number
          id?: string
          month?: number
          seller_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      outstanding_values: {
        Row: {
          client_name: string
          client_whatsapp: string | null
          created_at: string
          due_date: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          outstanding_value: number
          payment_platform: string
          sale_id: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          client_name?: string
          client_whatsapp?: string | null
          created_at?: string
          due_date: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          outstanding_value?: number
          payment_platform?: string
          sale_id: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          client_whatsapp?: string | null
          created_at?: string
          due_date?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          outstanding_value?: number
          payment_platform?: string
          sale_id?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          pipeline_id: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          active: boolean
          color: string
          created_at: string
          description: string
          id: string
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      presales_kpis: {
        Row: {
          assisted_sales: number
          calls_completed: number
          calls_scheduled: number
          created_at: string
          date: string
          followups_completed: number
          form_submissions_devclub: number
          form_submissions_global: number
          id: string
          instagram_conversations: number
          leads_contacted: number
          leads_qualified: number
          leads_reached: number
          pitches: number
          sales_scheduled: number
          seller_id: string
          updated_at: string
          whatsapp_conversations: number
        }
        Insert: {
          assisted_sales?: number
          calls_completed?: number
          calls_scheduled?: number
          created_at?: string
          date: string
          followups_completed?: number
          form_submissions_devclub?: number
          form_submissions_global?: number
          id?: string
          instagram_conversations?: number
          leads_contacted?: number
          leads_qualified?: number
          leads_reached?: number
          pitches?: number
          sales_scheduled?: number
          seller_id: string
          updated_at?: string
          whatsapp_conversations?: number
        }
        Update: {
          assisted_sales?: number
          calls_completed?: number
          calls_scheduled?: number
          created_at?: string
          date?: string
          followups_completed?: number
          form_submissions_devclub?: number
          form_submissions_global?: number
          id?: string
          instagram_conversations?: number
          leads_contacted?: number
          leads_qualified?: number
          leads_reached?: number
          pitches?: number
          sales_scheduled?: number
          seller_id?: string
          updated_at?: string
          whatsapp_conversations?: number
        }
        Relationships: []
      }
      presales_targets: {
        Row: {
          created_at: string
          id: string
          target_calls_scheduled_per_day: number
          target_followups_per_day: number
          target_leads_per_day: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_calls_scheduled_per_day?: number
          target_followups_per_day?: number
          target_leads_per_day?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          target_calls_scheduled_per_day?: number
          target_followups_per_day?: number
          target_leads_per_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          name: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          individual_goal: number
          is_editor: boolean
          name: string
          role: Database["public"]["Enums"]["app_role"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          individual_goal?: number
          is_editor?: boolean
          name: string
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          individual_goal?: number
          is_editor?: boolean
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount: number
          cash_collected: number
          client_name: string
          client_whatsapp: string | null
          commission_percentage: number
          commission_value: number
          created_at: string
          date: string
          expected_close_date: string | null
          future_due_date: string | null
          future_outstanding_value: number
          future_payment_platform: string
          id: string
          installments: number | null
          note: string
          origin: string
          outstanding_status: string
          pending_future_value: number
          platform: string
          product: string
          real_collected_this_month: number
          seller_id: string
          team_id: string | null
          temperature: string
          total_sale_value: number | null
          utm: string
        }
        Insert: {
          amount?: number
          cash_collected?: number
          client_name?: string
          client_whatsapp?: string | null
          commission_percentage?: number
          commission_value?: number
          created_at?: string
          date: string
          expected_close_date?: string | null
          future_due_date?: string | null
          future_outstanding_value?: number
          future_payment_platform?: string
          id?: string
          installments?: number | null
          note?: string
          origin?: string
          outstanding_status?: string
          pending_future_value?: number
          platform?: string
          product: string
          real_collected_this_month?: number
          seller_id: string
          team_id?: string | null
          temperature?: string
          total_sale_value?: number | null
          utm?: string
        }
        Update: {
          amount?: number
          cash_collected?: number
          client_name?: string
          client_whatsapp?: string | null
          commission_percentage?: number
          commission_value?: number
          created_at?: string
          date?: string
          expected_close_date?: string | null
          future_due_date?: string | null
          future_outstanding_value?: number
          future_payment_platform?: string
          id?: string
          installments?: number | null
          note?: string
          origin?: string
          outstanding_status?: string
          pending_future_value?: number
          platform?: string
          product?: string
          real_collected_this_month?: number
          seller_id?: string
          team_id?: string | null
          temperature?: string
          total_sale_value?: number | null
          utm?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_links: {
        Row: {
          created_at: string
          id: string
          link_url: string
          price: number
          product_name: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_url: string
          price?: number
          product_name: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          link_url?: string
          price?: number
          product_name?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_pairs: {
        Row: {
          created_at: string
          id: string
          presales_id: string
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          presales_id: string
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          presales_id?: string
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: []
      }
      seller_bonuses: {
        Row: {
          amount: number
          bonus_date: string
          category: string
          created_at: string
          description: string
          id: string
          month: number
          seller_id: string
          year: number
        }
        Insert: {
          amount?: number
          bonus_date?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          month: number
          seller_id: string
          year: number
        }
        Update: {
          amount?: number
          bonus_date?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          month?: number
          seller_id?: string
          year?: number
        }
        Relationships: []
      }
      team_goals: {
        Row: {
          created_at: string
          daily_goal: number
          id: string
          month: number
          monthly_goal: number
          monthly_hyper_goal: number
          team_id: string
          updated_at: string
          weekly_goal: number
          year: number
        }
        Insert: {
          created_at?: string
          daily_goal?: number
          id?: string
          month: number
          monthly_goal?: number
          monthly_hyper_goal?: number
          team_id: string
          updated_at?: string
          weekly_goal?: number
          year: number
        }
        Update: {
          created_at?: string
          daily_goal?: number
          id?: string
          month?: number
          monthly_goal?: number
          monthly_hyper_goal?: number
          team_id?: string
          updated_at?: string
          weekly_goal?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_settings: {
        Row: {
          created_at: string
          id: string
          origins: string[]
          team_goal: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          origins?: string[]
          team_goal?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          origins?: string[]
          team_goal?: number
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          archived: boolean
          created_at: string
          description: string
          id: string
          image_url: string
          name: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          name: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tv_public_links: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          short_code: string
          token: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          short_code?: string
          token?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          short_code?: string
          token?: string
        }
        Relationships: []
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
      webinar_global_debriefings: {
        Row: {
          applications: number
          capture_from: string | null
          capture_to: string | null
          cost_per_mql: number
          cpl: number
          created_at: string
          created_by: string | null
          id: string
          investment: number
          is_replay: boolean
          leads: number
          live_attendees: number
          mql_rate: number
          mqls: number
          replay_of_id: string | null
          updated_at: string
          webinar_date: string
          week_label: string | null
          whatsapp_leads: number
        }
        Insert: {
          applications?: number
          capture_from?: string | null
          capture_to?: string | null
          cost_per_mql?: number
          cpl?: number
          created_at?: string
          created_by?: string | null
          id?: string
          investment?: number
          is_replay?: boolean
          leads?: number
          live_attendees?: number
          mql_rate?: number
          mqls?: number
          replay_of_id?: string | null
          updated_at?: string
          webinar_date: string
          week_label?: string | null
          whatsapp_leads?: number
        }
        Update: {
          applications?: number
          capture_from?: string | null
          capture_to?: string | null
          cost_per_mql?: number
          cpl?: number
          created_at?: string
          created_by?: string | null
          id?: string
          investment?: number
          is_replay?: boolean
          leads?: number
          live_attendees?: number
          mql_rate?: number
          mqls?: number
          replay_of_id?: string | null
          updated_at?: string
          webinar_date?: string
          week_label?: string | null
          whatsapp_leads?: number
        }
        Relationships: [
          {
            foreignKeyName: "webinar_global_debriefings_replay_of_id_fkey"
            columns: ["replay_of_id"]
            isOneToOne: false
            referencedRelation: "webinar_global_debriefings"
            referencedColumns: ["id"]
          },
        ]
      }
      webinar_global_metrics: {
        Row: {
          created_at: string
          day: string | null
          id: string
          metric_key: string
          metric_value: number
          raw: Json | null
          source_sheet: string
        }
        Insert: {
          created_at?: string
          day?: string | null
          id?: string
          metric_key: string
          metric_value?: number
          raw?: Json | null
          source_sheet?: string
        }
        Update: {
          created_at?: string
          day?: string | null
          id?: string
          metric_key?: string
          metric_value?: number
          raw?: Json | null
          source_sheet?: string
        }
        Relationships: []
      }
      webinar_global_settings: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_row_count: number | null
          last_status: string | null
          last_synced_at: string | null
          sheet_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_row_count?: number | null
          last_status?: string | null
          last_synced_at?: string | null
          sheet_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_row_count?: number | null
          last_status?: string | null
          last_synced_at?: string | null
          sheet_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tv_token: { Args: never; Returns: string }
      has_active_tv_link: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "gestor"
        | "vendedor"
        | "pre-vendedor"
        | "financeiro"
        | "marketing"
      lead_status:
        | "new"
        | "contacted"
        | "follow_up"
        | "qualified"
        | "scheduled"
        | "lost"
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
      app_role: [
        "gestor",
        "vendedor",
        "pre-vendedor",
        "financeiro",
        "marketing",
      ],
      lead_status: [
        "new",
        "contacted",
        "follow_up",
        "qualified",
        "scheduled",
        "lost",
      ],
    },
  },
} as const
