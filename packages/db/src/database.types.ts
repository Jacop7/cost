export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      brands: {
        Row: {
          hidden: boolean
          id: string
          name: string
          store_id: string
        }
        Insert: {
          hidden?: boolean
          id?: string
          name: string
          store_id: string
        }
        Update: {
          hidden?: boolean
          id?: string
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      business_day_revisions: {
        Row: {
          after_basis_quality:
            | Database["public"]["Enums"]["day_basis_quality"]
            | null
          after_detail: Json | null
          after_summary: Json
          before_basis_quality:
            | Database["public"]["Enums"]["day_basis_quality"]
            | null
          before_detail: Json | null
          before_summary: Json
          business_day_id: string
          changed_at: string
          changed_by: string | null
          id: string
          reason: string | null
          revision_no: number
        }
        Insert: {
          after_basis_quality?:
            | Database["public"]["Enums"]["day_basis_quality"]
            | null
          after_detail?: Json | null
          after_summary: Json
          before_basis_quality?:
            | Database["public"]["Enums"]["day_basis_quality"]
            | null
          before_detail?: Json | null
          before_summary: Json
          business_day_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          reason?: string | null
          revision_no: number
        }
        Update: {
          after_basis_quality?:
            | Database["public"]["Enums"]["day_basis_quality"]
            | null
          after_detail?: Json | null
          after_summary?: Json
          before_basis_quality?:
            | Database["public"]["Enums"]["day_basis_quality"]
            | null
          before_detail?: Json | null
          before_summary?: Json
          business_day_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          reason?: string | null
          revision_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_day_revisions_business_day_id_fkey"
            columns: ["business_day_id"]
            isOneToOne: false
            referencedRelation: "business_days"
            referencedColumns: ["id"]
          },
        ]
      }
      business_days: {
        Row: {
          basis_quality: Database["public"]["Enums"]["day_basis_quality"]
          business_date: string
          close_method:
            | Database["public"]["Enums"]["business_close_method"]
            | null
          closed_at: string | null
          created_at: string
          id: string
          last_activity_at: string
          opened_at: string | null
          operating_rule_id: string | null
          planned_close_at: string
          revision_no: number
          scheduled_open_at: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["business_day_status"]
          store_id: string
        }
        Insert: {
          basis_quality?: Database["public"]["Enums"]["day_basis_quality"]
          business_date: string
          close_method?:
            | Database["public"]["Enums"]["business_close_method"]
            | null
          closed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          opened_at?: string | null
          operating_rule_id?: string | null
          planned_close_at: string
          revision_no?: number
          scheduled_open_at?: string | null
          snapshot: Json
          status?: Database["public"]["Enums"]["business_day_status"]
          store_id: string
        }
        Update: {
          basis_quality?: Database["public"]["Enums"]["day_basis_quality"]
          business_date?: string
          close_method?:
            | Database["public"]["Enums"]["business_close_method"]
            | null
          closed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          opened_at?: string | null
          operating_rule_id?: string | null
          planned_close_at?: string
          revision_no?: number
          scheduled_open_at?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["business_day_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_days_operating_rule_id_fkey"
            columns: ["operating_rule_id"]
            isOneToOne: false
            referencedRelation: "operating_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_days_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      business_state_transitions: {
        Row: {
          at: string
          business_day_id: string
          by_user: string | null
          from_status: Database["public"]["Enums"]["business_day_status"] | null
          id: string
          method: string
          store_id: string
          to_status: Database["public"]["Enums"]["business_day_status"]
        }
        Insert: {
          at?: string
          business_day_id: string
          by_user?: string | null
          from_status?:
            | Database["public"]["Enums"]["business_day_status"]
            | null
          id?: string
          method: string
          store_id: string
          to_status: Database["public"]["Enums"]["business_day_status"]
        }
        Update: {
          at?: string
          business_day_id?: string
          by_user?: string | null
          from_status?:
            | Database["public"]["Enums"]["business_day_status"]
            | null
          id?: string
          method?: string
          store_id?: string
          to_status?: Database["public"]["Enums"]["business_day_status"]
        }
        Relationships: [
          {
            foreignKeyName: "business_state_transitions_business_day_id_fkey"
            columns: ["business_day_id"]
            isOneToOne: false
            referencedRelation: "business_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_state_transitions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales: {
        Row: {
          business_day_id: string | null
          created_at: string
          daily_extra: number
          etc_items: Json
          etc_revenue: number
          etc_tax: number
          extra_items: Json
          id: string
          note: string | null
          revision: number
          sale_date: string
          store_id: string
          updated_at: string
        }
        Insert: {
          business_day_id?: string | null
          created_at?: string
          daily_extra?: number
          etc_items?: Json
          etc_revenue?: number
          etc_tax?: number
          extra_items?: Json
          id?: string
          note?: string | null
          revision?: number
          sale_date: string
          store_id: string
          updated_at?: string
        }
        Update: {
          business_day_id?: string | null
          created_at?: string
          daily_extra?: number
          etc_items?: Json
          etc_revenue?: number
          etc_tax?: number
          extra_items?: Json
          id?: string
          note?: string | null
          revision?: number
          sale_date?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_business_day_id_fkey"
            columns: ["business_day_id"]
            isOneToOne: false
            referencedRelation: "business_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_items: {
        Row: {
          created_at: string
          daily_sales_id: string
          id: string
          menu_name: string
          qty_delivery: number
          qty_hall: number
          qty_takeout: number
          qty_waste: number
          recipe_id: string | null
          store_id: string
          tax_mode: Database["public"]["Enums"]["tax_mode"] | null
          unit_extra_cost: number | null
          unit_material_cost: number | null
          unit_price: number
          unit_tax: number | null
        }
        Insert: {
          created_at?: string
          daily_sales_id: string
          id?: string
          menu_name: string
          qty_delivery?: number
          qty_hall?: number
          qty_takeout?: number
          qty_waste?: number
          recipe_id?: string | null
          store_id: string
          tax_mode?: Database["public"]["Enums"]["tax_mode"] | null
          unit_extra_cost?: number | null
          unit_material_cost?: number | null
          unit_price: number
          unit_tax?: number | null
        }
        Update: {
          created_at?: string
          daily_sales_id?: string
          id?: string
          menu_name?: string
          qty_delivery?: number
          qty_hall?: number
          qty_takeout?: number
          qty_waste?: number
          recipe_id?: string | null
          store_id?: string
          tax_mode?: Database["public"]["Enums"]["tax_mode"] | null
          unit_extra_cost?: number | null
          unit_material_cost?: number | null
          unit_price?: number
          unit_tax?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_items_daily_sales_id_fkey"
            columns: ["daily_sales_id"]
            isOneToOne: false
            referencedRelation: "daily_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_items_recipe_id_fk"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_change_events: {
        Row: {
          actor_id: string | null
          affects_sales: boolean
          business_day_id: string | null
          changes: Json
          correlation_id: string
          entity_id: string
          entity_type: string
          id: string
          occurred_at: string
          source_entity_id: string | null
          source_type: Database["public"]["Enums"]["change_source"]
          store_id: string
          summary: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          affects_sales?: boolean
          business_day_id?: string | null
          changes?: Json
          correlation_id?: string
          entity_id: string
          entity_type: string
          id?: string
          occurred_at?: string
          source_entity_id?: string | null
          source_type: Database["public"]["Enums"]["change_source"]
          store_id: string
          summary?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          affects_sales?: boolean
          business_day_id?: string | null
          changes?: Json
          correlation_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          occurred_at?: string
          source_entity_id?: string | null
          source_type?: Database["public"]["Enums"]["change_source"]
          store_id?: string
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_change_events_business_day_id_fkey"
            columns: ["business_day_id"]
            isOneToOne: false
            referencedRelation: "business_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_change_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs_monthly: {
        Row: {
          id: string
          items: Json
          month: string
          store_id: string
          total_revenue: number
          updated_at: string
        }
        Insert: {
          id?: string
          items?: Json
          month: string
          store_id: string
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          id?: string
          items?: Json
          month?: string
          store_id?: string
          total_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_monthly_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          base_unit: Database["public"]["Enums"]["base_unit"]
          category_id: string | null
          created_at: string
          default_vendor_id: string | null
          id: string
          memo: string | null
          min_order_qty: number
          name: string
          per_volume: number
          purchase_unit_label: string | null
          safety_stock: number
          safety_stock_is_base: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_unit: Database["public"]["Enums"]["base_unit"]
          category_id?: string | null
          created_at?: string
          default_vendor_id?: string | null
          id?: string
          memo?: string | null
          min_order_qty?: number
          name: string
          per_volume: number
          purchase_unit_label?: string | null
          safety_stock?: number
          safety_stock_is_base?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_unit?: Database["public"]["Enums"]["base_unit"]
          category_id?: string | null
          created_at?: string
          default_vendor_id?: string | null
          id?: string
          memo?: string | null
          min_order_qty?: number
          name?: string
          per_volume?: number
          purchase_unit_label?: string | null
          safety_stock?: number
          safety_stock_is_base?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_default_vendor_id_fkey"
            columns: ["default_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_events: {
        Row: {
          business_day_id: string | null
          count_delta: number | null
          id: string
          idempotency_key: string | null
          ingredient_id: string
          note: string | null
          occurred_at: string
          order_record_id: string | null
          reverses_event_id: string | null
          sales_item_id: string | null
          seq: number
          store_id: string
          type: Database["public"]["Enums"]["inventory_event_type"]
          unit_normalized: boolean
          volume_delta: number | null
          waste: boolean
        }
        Insert: {
          business_day_id?: string | null
          count_delta?: number | null
          id?: string
          idempotency_key?: string | null
          ingredient_id: string
          note?: string | null
          occurred_at?: string
          order_record_id?: string | null
          reverses_event_id?: string | null
          sales_item_id?: string | null
          seq?: number
          store_id: string
          type: Database["public"]["Enums"]["inventory_event_type"]
          unit_normalized?: boolean
          volume_delta?: number | null
          waste?: boolean
        }
        Update: {
          business_day_id?: string | null
          count_delta?: number | null
          id?: string
          idempotency_key?: string | null
          ingredient_id?: string
          note?: string | null
          occurred_at?: string
          order_record_id?: string | null
          reverses_event_id?: string | null
          sales_item_id?: string | null
          seq?: number
          store_id?: string
          type?: Database["public"]["Enums"]["inventory_event_type"]
          unit_normalized?: boolean
          volume_delta?: number | null
          waste?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_events_business_day_id_fkey"
            columns: ["business_day_id"]
            isOneToOne: false
            referencedRelation: "business_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_ingredient_id_fk"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_order_fk"
            columns: ["order_record_id"]
            isOneToOne: false
            referencedRelation: "order_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_reverses_event_id_fkey"
            columns: ["reverses_event_id"]
            isOneToOne: false
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_sales_item_id_fk"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "daily_sales_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_states: {
        Row: {
          ingredient_id: string
          last_inbound_at: string | null
          soon_out: boolean
          stock_total: number
          store_id: string
          updated_at: string
        }
        Insert: {
          ingredient_id: string
          last_inbound_at?: string | null
          soon_out?: boolean
          stock_total?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          ingredient_id?: string
          last_inbound_at?: string | null
          soon_out?: boolean
          stock_total?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_states_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: true
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_states_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          id: string
          memo: string | null
          name: string
          store_id: string
          unit_cost: number
          unit_label: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          name: string
          store_id: string
          unit_cost?: number
          unit_label?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          name?: string
          store_id?: string
          unit_cost?: number
          unit_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_pl: {
        Row: {
          fixed_cost: number
          material_cost: number
          month: string
          profit: number
          profit_rate: number
          revenue: number
          store_id: string
          updated_at: string
        }
        Insert: {
          fixed_cost?: number
          material_cost?: number
          month: string
          profit?: number
          profit_rate?: number
          revenue?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          fixed_cost?: number
          material_cost?: number
          month?: string
          profit?: number
          profit_rate?: number
          revenue?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_pl_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_rules: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          revision: number
          store_id: string
          weekly_breaks: Json
          weekly_hours: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          revision?: number
          store_id: string
          weekly_breaks?: Json
          weekly_hours: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          revision?: number
          store_id?: string
          weekly_breaks?: Json
          weekly_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "operating_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_candidates: {
        Row: {
          id: string
          ingredient_id: string
          reasons: Database["public"]["Enums"]["candidate_reason"][]
          recommended_qty: number
          status: Database["public"]["Enums"]["candidate_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          reasons?: Database["public"]["Enums"]["candidate_reason"][]
          recommended_qty?: number
          status?: Database["public"]["Enums"]["candidate_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          reasons?: Database["public"]["Enums"]["candidate_reason"][]
          recommended_qty?: number
          status?: Database["public"]["Enums"]["candidate_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_candidates_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_candidates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_records: {
        Row: {
          amount: number
          brand_id: string | null
          business_day_id: string | null
          created_at: string
          expected_at: string | null
          id: string
          ingredient_id: string
          ordered_at: string
          qty: number
          received_qty: number
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          vendor_id: string | null
          volume: number
        }
        Insert: {
          amount: number
          brand_id?: string | null
          business_day_id?: string | null
          created_at?: string
          expected_at?: string | null
          id?: string
          ingredient_id: string
          ordered_at: string
          qty: number
          received_qty?: number
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          vendor_id?: string | null
          volume: number
        }
        Update: {
          amount?: number
          brand_id?: string | null
          business_day_id?: string | null
          created_at?: string
          expected_at?: string | null
          id?: string
          ingredient_id?: string
          ordered_at?: string
          qty?: number
          received_qty?: number
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          vendor_id?: string | null
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_records_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_records_business_day_id_fkey"
            columns: ["business_day_id"]
            isOneToOne: false
            referencedRelation: "business_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_records_ingredient_id_fk"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_records_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      price_trends: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          order_record_id: string | null
          store_id: string
          trend_date: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          order_record_id?: string | null
          store_id: string
          trend_date: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          order_record_id?: string | null
          store_id?: string
          trend_date?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_trends_ingredient_id_fk"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_trends_order_record_id_fkey"
            columns: ["order_record_id"]
            isOneToOne: false
            referencedRelation: "order_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_trends_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_trends: {
        Row: {
          calculation_version: number
          cause: Database["public"]["Enums"]["trend_cause"]
          created_at: string
          extra_cost: number | null
          fixed_cost: number | null
          fixed_rate: number | null
          id: string
          is_baseline: boolean
          material_cost: number | null
          material_rate: number
          occurred_at: string
          previous_snapshot_id: string | null
          price: number | null
          profit_amount: number | null
          profit_rate: number
          recipe_id: string
          source_entity_id: string | null
          source_label: string | null
          source_type: string | null
          store_id: string
          summary: string | null
          tax_amount: number | null
          trend_date: string
        }
        Insert: {
          calculation_version?: number
          cause: Database["public"]["Enums"]["trend_cause"]
          created_at?: string
          extra_cost?: number | null
          fixed_cost?: number | null
          fixed_rate?: number | null
          id?: string
          is_baseline?: boolean
          material_cost?: number | null
          material_rate: number
          occurred_at?: string
          previous_snapshot_id?: string | null
          price?: number | null
          profit_amount?: number | null
          profit_rate: number
          recipe_id: string
          source_entity_id?: string | null
          source_label?: string | null
          source_type?: string | null
          store_id: string
          summary?: string | null
          tax_amount?: number | null
          trend_date: string
        }
        Update: {
          calculation_version?: number
          cause?: Database["public"]["Enums"]["trend_cause"]
          created_at?: string
          extra_cost?: number | null
          fixed_cost?: number | null
          fixed_rate?: number | null
          id?: string
          is_baseline?: boolean
          material_cost?: number | null
          material_rate?: number
          occurred_at?: string
          previous_snapshot_id?: string | null
          price?: number | null
          profit_amount?: number | null
          profit_rate?: number
          recipe_id?: string
          source_entity_id?: string | null
          source_label?: string | null
          source_type?: string | null
          store_id?: string
          summary?: string | null
          tax_amount?: number | null
          trend_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "profit_trends_previous_snapshot_id_fkey"
            columns: ["previous_snapshot_id"]
            isOneToOne: false
            referencedRelation: "profit_trends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_trends_recipe_id_fk"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_trends_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_options: {
        Row: {
          amount: number
          brand_id: string | null
          created_at: string
          hidden: boolean
          id: string
          ingredient_id: string
          purchase_name: string
          store_id: string
          url: string | null
          vendor_id: string | null
          volume: number
        }
        Insert: {
          amount: number
          brand_id?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          ingredient_id: string
          purchase_name: string
          store_id: string
          url?: string | null
          vendor_id?: string | null
          volume: number
        }
        Update: {
          amount?: number
          brand_id?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          ingredient_id?: string
          purchase_name?: string
          store_id?: string
          url?: string | null
          vendor_id?: string | null
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_options_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_options_ingredient_id_fk"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_options_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_options_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_extra_costs: {
        Row: {
          amount_per_serving: number
          id: string
          material_id: string | null
          name: string
          qty: number
          recipe_id: string
          store_id: string
        }
        Insert: {
          amount_per_serving?: number
          id?: string
          material_id?: string | null
          name: string
          qty?: number
          recipe_id: string
          store_id: string
        }
        Update: {
          amount_per_serving?: number
          id?: string
          material_id?: string | null
          name?: string
          qty?: number
          recipe_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_extra_costs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_extra_costs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_extra_costs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_lines: {
        Row: {
          id: string
          ingredient_id: string | null
          input_qty: number
          recipe_id: string
          store_id: string
          sub_recipe_id: string | null
        }
        Insert: {
          id?: string
          ingredient_id?: string | null
          input_qty: number
          recipe_id: string
          store_id: string
          sub_recipe_id?: string | null
        }
        Update: {
          id?: string
          ingredient_id?: string | null
          input_qty?: number
          recipe_id?: string
          store_id?: string
          sub_recipe_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_lines_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_lines_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_lines_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_lines_sub_recipe_id_fkey"
            columns: ["sub_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          active: boolean
          avg_monthly_sales: number | null
          base_servings: number
          category_id: string | null
          created_at: string
          id: string
          memo: string | null
          name: string
          price: number
          store_id: string
          target_profit_rate: number
          tax_items: Json
          tax_mode: Database["public"]["Enums"]["tax_mode"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          avg_monthly_sales?: number | null
          base_servings?: number
          category_id?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          name: string
          price?: number
          store_id: string
          target_profit_rate?: number
          tax_items?: Json
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          avg_monthly_sales?: number | null
          base_servings?: number
          category_id?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          name?: string
          price?: number
          store_id?: string
          target_profit_rate?: number
          tax_items?: Json
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_channels: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          retired_at: string | null
          sort_order: number
          store_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          retired_at?: string | null
          sort_order?: number
          store_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          retired_at?: string | null
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_channels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          alert_inbound_delay: boolean
          alert_morning_summary: boolean
          alert_price_spike: boolean
          alert_target_miss: boolean
          break_end: string | null
          break_start: string | null
          close_time: string
          cup_volume: number
          currency: string
          default_target_profit_rate: number
          locale: string
          money_digits: number
          open_time: string
          quantity_digits: number
          store_id: string
          tax_items: Json
          tax_mode: Database["public"]["Enums"]["tax_mode"]
          unit_price_digits: number
          unit_system: string
          updated_at: string
        }
        Insert: {
          alert_inbound_delay?: boolean
          alert_morning_summary?: boolean
          alert_price_spike?: boolean
          alert_target_miss?: boolean
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          cup_volume?: number
          currency?: string
          default_target_profit_rate?: number
          locale?: string
          money_digits?: number
          open_time?: string
          quantity_digits?: number
          store_id: string
          tax_items?: Json
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          unit_price_digits?: number
          unit_system?: string
          updated_at?: string
        }
        Update: {
          alert_inbound_delay?: boolean
          alert_morning_summary?: boolean
          alert_price_spike?: boolean
          alert_target_miss?: boolean
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          cup_volume?: number
          currency?: string
          default_target_profit_rate?: number
          locale?: string
          money_digits?: number
          open_time?: string
          quantity_digits?: number
          store_id?: string
          tax_items?: Json
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          unit_price_digits?: number
          unit_system?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_time_settings: {
        Row: {
          confirmed: boolean
          created_at: string
          store_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          store_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          store_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_time_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          hidden: boolean
          id: string
          name: string
          store_id: string
        }
        Insert: {
          hidden?: boolean
          id?: string
          name: string
          store_id: string
        }
        Update: {
          hidden?: boolean
          id?: string
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_to_day_basis: {
        Args: {
          p_store: string
          p_date: string
          p_recipe: string
          p_allow_closed?: boolean
        }
        Returns: Json
      }
      amend_ended_business_day: {
        Args: {
          p_store: string
          p_date: string
          p_base_revision: number
          p_items?: Json
          p_etc_items?: Json
          p_extra_items?: Json
          p_reason?: string
        }
        Returns: Json
      }
      apply_due_breaks: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      apply_sale_items: {
        Args: {
          p_store: string
          p_date: string
          p_sales: string
          p_items: Json
          p_etc_items: Json
          p_extra_items: Json
          p_allow_closed?: boolean
        }
        Returns: Json
      }
      assert_my_store: {
        Args: {
          p_store: string
        }
        Returns: undefined
      }
      assert_no_rpc_overloads: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      assert_tax_items: {
        Args: {
          p_items: Json
        }
        Returns: Json
      }
      assert_weekly_breaks: {
        Args: {
          p: Json
        }
        Returns: boolean
      }
      assert_weekly_hours: {
        Args: {
          p: Json
        }
        Returns: boolean
      }
      assert_weekly_schedule: {
        Args: {
          p_hours: Json
          p_breaks: Json
        }
        Returns: boolean
      }
      auto_close_grace: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      base_unit_price: {
        Args: {
          p_ingredient: string
        }
        Returns: number
      }
      build_day_snapshot: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: Json
      }
      business_day_of: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: {
          basis_quality: Database["public"]["Enums"]["day_basis_quality"]
          business_date: string
          close_method:
            | Database["public"]["Enums"]["business_close_method"]
            | null
          closed_at: string | null
          created_at: string
          id: string
          last_activity_at: string
          opened_at: string | null
          operating_rule_id: string | null
          planned_close_at: string
          revision_no: number
          scheduled_open_at: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["business_day_status"]
          store_id: string
        }
      }
      business_day_state: {
        Args: {
          p_store: string
        }
        Returns: Json
      }
      business_month: {
        Args: {
          p_at?: string
        }
        Returns: string
      }
      business_tz: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      category_name: {
        Args: {
          p_id: string
        }
        Returns: string
      }
      change_event_json: {
        Args: {
          p_event: unknown
        }
        Returns: Json
      }
      change_line: {
        Args: {
          p_key: string
          p_label: string
          p_before: unknown
          p_after: unknown
          p_unit?: string
          p_kind?: string
        }
        Returns: Json
      }
      close_business_day: {
        Args: {
          p_store: string
        }
        Returns: Json
      }
      close_business_day_row: {
        Args: {
          p_day_id: string
          p_method: Database["public"]["Enums"]["business_close_method"]
        }
        Returns: Json
      }
      close_due_business_days: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      consume_stock: {
        Args: {
          p_ingredient: string
          p_amount: number
          p_allow_negative?: boolean
        }
        Returns: number
      }
      current_business_day: {
        Args: {
          p_store: string
        }
        Returns: {
          basis_quality: Database["public"]["Enums"]["day_basis_quality"]
          business_date: string
          close_method:
            | Database["public"]["Enums"]["business_close_method"]
            | null
          closed_at: string | null
          created_at: string
          id: string
          last_activity_at: string
          opened_at: string | null
          operating_rule_id: string | null
          planned_close_at: string
          revision_no: number
          scheduled_open_at: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["business_day_status"]
          store_id: string
        }
      }
      day_etc_tax_rate: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: number
      }
      day_fixed_items: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: Json
      }
      day_fixed_rate: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: number
      }
      day_fixed_total: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: number
      }
      day_ingredient_needs: {
        Args: {
          p_store: string
          p_date: string
          p_recipe: string
          p_servings: number
        }
        Returns: {
          ingredient_id: string
          amount: number
        }[]
      }
      day_menu_basis: {
        Args: {
          p_store: string
          p_date?: string
        }
        Returns: Json
      }
      day_menu_detail: {
        Args: {
          p_store: string
          p_date: string
          p_recipe: string
        }
        Returns: Json
      }
      day_recipe_snapshot: {
        Args: {
          p_store: string
          p_date: string
          p_recipe: string
        }
        Returns: Json
      }
      day_revenue: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: number
      }
      day_sales_detail: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: Json
      }
      day_snapshot: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: Json
      }
      day_unit_price: {
        Args: {
          p_store: string
          p_date: string
          p_ingredient: string
        }
        Returns: number
      }
      deactivate_ingredient: {
        Args: {
          p_ingredient: string
        }
        Returns: undefined
      }
      deactivate_material: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      deactivate_recipe: {
        Args: {
          p_recipe: string
        }
        Returns: undefined
      }
      delete_category: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      delete_purchase_option: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      delete_vendor: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      discard_delete_days: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      e1_confirm_inbound: {
        Args: {
          p_order: string
          p_actual_qty?: number
          p_idempotency_key?: string
          p_occurred_at?: string
        }
        Returns: Json
      }
      e10_sale_recorded: {
        Args: {
          p_store: string
          p_date: string
          p_recipe: string
          p_qty_hall?: number
          p_qty_delivery?: number
          p_qty_takeout?: number
          p_qty_waste?: number
          p_allow_closed?: boolean
        }
        Returns: Json
      }
      e11_inbound_reverted: {
        Args: {
          p_order: string
          p_reason?: string
        }
        Returns: Json
      }
      e12_order_canceled: {
        Args: {
          p_order: string
          p_reason?: string
        }
        Returns: Json
      }
      e2_discard: {
        Args: {
          p_ingredient: string
          p_remain_volume: number
          p_occurred_at?: string
        }
        Returns: Json
      }
      e2_discard_reverted: {
        Args: {
          p_event: string
          p_reason?: string
        }
        Returns: Json
      }
      e3_recipe_saved: {
        Args: {
          p_recipe: string
          p_occurred_at?: string
        }
        Returns: undefined
      }
      e4_fixed_cost_saved: {
        Args: {
          p_store: string
          p_month: string
          p_prev_rate?: number
        }
        Returns: Json
      }
      e5_stock_adjusted: {
        Args: {
          p_ingredient: string
          p_stock_total: number
          p_soon: boolean
          p_note?: string
          p_occurred_at?: string
        }
        Returns: Json
      }
      e7_place_order: {
        Args: {
          p_store: string
          p_ingredient: string
          p_vendor: string
          p_brand: string
          p_volume: number
          p_amount: number
          p_qty: number
          p_expected: string
          p_source?: Database["public"]["Enums"]["order_source"]
          p_ordered_at?: string
        }
        Returns: string
      }
      e8_sales_consumed: {
        Args: {
          p_sales_item: string
        }
        Returns: Json
      }
      e9_sales_reverted: {
        Args: {
          p_sales_item: string
        }
        Returns: Json
      }
      entity_change_history: {
        Args: {
          p_store: string
          p_entity_type: string
          p_entity_id: string
          p_cursor?: string
          p_limit?: number
          p_days?: number
        }
        Returns: Json
      }
      entity_change_state: {
        Args: {
          p_event: unknown
        }
        Returns: string
      }
      fixed_cost_rate: {
        Args: {
          p_store: string
          p_month: string
        }
        Returns: number
      }
      fixed_cost_revenue_check: {
        Args: {
          p_store: string
          p_month: string
        }
        Returns: Json
      }
      get_settings: {
        Args: {
          p_store: string
        }
        Returns: Json
      }
      ingredient_detail: {
        Args: {
          p_ingredient: string
        }
        Returns: Json
      }
      ingredient_list: {
        Args: {
          p_store: string
        }
        Returns: {
          id: string
          name: string
          category_name: string
          base_unit: Database["public"]["Enums"]["base_unit"]
          per_volume: number
          safety_stock: number
          vendor_name: string
          memo: string
          stock_total: number
          base_price: number
          soon_out: boolean
          last_inbound_at: string
        }[]
      }
      ingredient_loss: {
        Args: {
          p_ingredient: string
        }
        Returns: Json
      }
      last_entity_change: {
        Args: {
          p_store: string
          p_entity_type: string
          p_entity_id: string
        }
        Returns: Json
      }
      lock_business_scope: {
        Args: {
          p_store: string
        }
        Returns: undefined
      }
      money_short: {
        Args: {
          p: number
        }
        Returns: string
      }
      my_store_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      next_scheduled_open: {
        Args: {
          p_store: string
          p_after: string
        }
        Returns: string
      }
      normalize_day_times: {
        Args: {
          p: Json
        }
        Returns: Json
      }
      open_business_day: {
        Args: {
          p_store: string
          p_date?: string
          p_close_time?: string
        }
        Returns: Json
      }
      operating_hours_status: {
        Args: {
          p_store: string
        }
        Returns: Json
      }
      operating_rule_at: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          revision: number
          store_id: string
          weekly_breaks: Json
          weekly_hours: Json
        }
      }
      order_board: {
        Args: {
          p_store: string
        }
        Returns: Json
      }
      planned_close: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: string
      }
      profit_delta_cause: {
        Args: {
          p_prev: unknown
          p_cur: unknown
        }
        Returns: Json
      }
      profit_event_title: {
        Args: {
          p_source_type: string
          p_label: string
        }
        Returns: string
      }
      purchase_history: {
        Args: {
          p_ingredient: string
          p_from?: string
          p_to?: string
        }
        Returns: {
          id: string
          ordered_at: string
          expected_at: string
          status: Database["public"]["Enums"]["order_status"]
          vendor_name: string
          volume: number
          amount: number
          qty: number
          received_qty: number
          unit_price: number
        }[]
      }
      purge_entity_changes: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      quick_inbound: {
        Args: {
          p_store: string
          p_ingredient: string
          p_volume: number
          p_amount: number
          p_qty?: number
          p_vendor?: string
          p_occurred_at?: string
          p_idempotency_key?: string
        }
        Returns: Json
      }
      quick_inbound_preview: {
        Args: {
          p_store: string
          p_ingredient: string
          p_volume: number
          p_amount: number
          p_qty?: number
        }
        Returns: Json
      }
      range_menu_detail: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
          p_recipe: string
        }
        Returns: Json
      }
      recipe_blocked_by: {
        Args: {
          p_recipe: string
        }
        Returns: string
      }
      recipe_change_state: {
        Args: {
          p_store: string
          p_recipe: string
          p_occurred_at: string
          p_business_day: string
          p_affects: boolean
        }
        Returns: string
      }
      recipe_detail: {
        Args: {
          p_recipe: string
        }
        Returns: Json
      }
      recipe_ingredient_needs: {
        Args: {
          p_recipe: string
          p_servings: number
          p_depth?: number
        }
        Returns: {
          ingredient_id: string
          amount: number
        }[]
      }
      recipe_list: {
        Args: {
          p_store: string
        }
        Returns: {
          id: string
          name: string
          price: number
          tax_mode: Database["public"]["Enums"]["tax_mode"]
          base_servings: number
          target_profit_rate: number
          avg_monthly_sales: number
          active: boolean
          category_id: string
          category_name: string
          material_cost: number
          extra_cost: number
          tax: number
          fixed_cost: number
          profit: number
          profit_rate: number
          material_rate: number
          unknown_cost_lines: number
          blocked_by: string
        }[]
      }
      recipe_material_cost: {
        Args: {
          p_recipe: string
          p_depth?: number
        }
        Returns: number
      }
      recipe_pick_list: {
        Args: {
          p_store: string
          p_exclude?: string
        }
        Returns: {
          id: string
          name: string
          base_servings: number
          unit_cost: number
          active: boolean
        }[]
      }
      recipe_profit_history: {
        Args: {
          p_recipe: string
          p_before?: string
          p_before_id?: string
          p_limit?: number
        }
        Returns: Json
      }
      recipe_shortages: {
        Args: {
          p_store: string
        }
        Returns: Json
      }
      recipe_snapshot_entry: {
        Args: {
          p_recipe: string
        }
        Returns: Json
      }
      recipe_tax: {
        Args: {
          p_recipe: string
        }
        Returns: number
      }
      recipe_tax_items: {
        Args: {
          p_recipe: string
        }
        Returns: Json
      }
      recompute_recipe: {
        Args: {
          p_recipe: string
          p_cause: Database["public"]["Enums"]["trend_cause"]
          p_occurred_at?: string
          p_source?: string
        }
        Returns: undefined
      }
      reconcile_sales_consumption: {
        Args: {
          p_sales_item: string
          p_zero?: boolean
        }
        Returns: Json
      }
      record_entity_change: {
        Args: {
          p_store: string
          p_entity_type: string
          p_entity_id: string
          p_source: Database["public"]["Enums"]["change_source"]
          p_title: string
          p_changes: Json
          p_affects?: boolean
          p_source_entity?: string
          p_correlation?: string
          p_summary?: string
        }
        Returns: string
      }
      record_state_transition: {
        Args: {
          p_day: unknown
          p_from: Database["public"]["Enums"]["business_day_status"]
          p_to: Database["public"]["Enums"]["business_day_status"]
          p_method: string
        }
        Returns: undefined
      }
      refresh_order_candidate: {
        Args: {
          p_ingredient: string
        }
        Returns: undefined
      }
      reorder_categories: {
        Args: {
          p_store: string
          p_ids: string[]
        }
        Returns: undefined
      }
      resolve_sales_business_context: {
        Args: {
          p_store: string
          p_at?: string
        }
        Returns: Database["public"]["CompositeTypes"]["sales_business_context"]
      }
      restore_stock: {
        Args: {
          p_ingredient: string
          p_amount: number
        }
        Returns: number
      }
      retire_channel: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      rule_hours_on: {
        Args: {
          p_rule: string
          p_date: string
        }
        Returns: Json
      }
      sale_date_allowed: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: boolean
      }
      sale_shortages: {
        Args: {
          p_store: string
          p_date: string
          p_items: Json
        }
        Returns: Json
      }
      sales_channel_fixed: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      sales_day: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: Json
      }
      sales_etc_by_channel: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      sales_extra_usage: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      sales_fixed_breakdown: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      sales_material_usage: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      sales_range: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      sales_summary: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      sales_tax_breakdown: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      sales_waste_breakdown: {
        Args: {
          p_store: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      save_category: {
        Args: {
          p_store: string
          p_payload: Json
        }
        Returns: string
      }
      save_channel: {
        Args: {
          p_store: string
          p_payload: Json
        }
        Returns: string
      }
      save_fixed_costs: {
        Args: {
          p_store: string
          p_month: string
          p_total_revenue: number
          p_items: Json
        }
        Returns: Json
      }
      save_ingredient: {
        Args: {
          p_store: string
          p_payload: Json
        }
        Returns: string
      }
      save_material: {
        Args: {
          p_store: string
          p_payload: Json
        }
        Returns: string
      }
      save_purchase_option: {
        Args: {
          p_store: string
          p_payload: Json
        }
        Returns: string
      }
      save_recipe: {
        Args: {
          p_store: string
          p_payload: Json
        }
        Returns: string
      }
      save_sale: {
        Args: {
          p_store: string
          p_date: string
          p_items: Json
          p_etc_items?: Json
          p_extra_items?: Json
          p_base_revision?: number
          p_open_day?: boolean
          p_open_close_time?: string
        }
        Returns: Json
      }
      save_settings: {
        Args: {
          p_store: string
          p_payload: Json
        }
        Returns: undefined
      }
      save_store_tax: {
        Args: {
          p_store: string
          p_mode: Database["public"]["Enums"]["tax_mode"]
          p_items?: Json
        }
        Returns: Json
      }
      save_vendor: {
        Args: {
          p_store: string
          p_payload: Json
        }
        Returns: string
      }
      scheduled_open_at: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: string
      }
      set_break_row: {
        Args: {
          p_day_id: string
          p_on: boolean
          p_method: string
        }
        Returns: Json
      }
      set_operating_hours: {
        Args: {
          p_store: string
          p_weekly_hours: Json
          p_weekly_breaks?: Json
          p_base_rule_id?: string
          p_base_revision?: number
        }
        Returns: Json
      }
      set_store_timezone: {
        Args: {
          p_store: string
          p_timezone: string
        }
        Returns: Json
      }
      settings_lists: {
        Args: {
          p_store: string
        }
        Returns: Json
      }
      stock_history: {
        Args: {
          p_ingredient: string
          p_from?: string
          p_to?: string
        }
        Returns: {
          id: string
          occurred_on: string
          type: Database["public"]["Enums"]["inventory_event_type"]
          count_delta: number
          volume_delta: number
          note: string
          balance: number
          reverted: boolean
          waste: boolean
        }[]
      }
      stock_total_base: {
        Args: {
          p_ingredient: string
        }
        Returns: number
      }
      store_hours_on: {
        Args: {
          p_store: string
          p_date: string
        }
        Returns: Json
      }
      store_local_date: {
        Args: {
          p_store: string
          p_at?: string
        }
        Returns: string
      }
      store_local_month: {
        Args: {
          p_store: string
          p_at?: string
        }
        Returns: string
      }
      store_tax_rate: {
        Args: {
          p_store: string
        }
        Returns: number
      }
      store_timezone: {
        Args: {
          p_store: string
        }
        Returns: string
      }
      tax_breakdown: {
        Args: {
          p_price: number
          p_mode: Database["public"]["Enums"]["tax_mode"]
          p_items: Json
        }
        Returns: Json
      }
      tax_of: {
        Args: {
          p_price: number
          p_mode: Database["public"]["Enums"]["tax_mode"]
          p_items: Json
        }
        Returns: number
      }
      transition_business_state: {
        Args: {
          p_store: string
          p_action: string
          p_close_time?: string
        }
        Returns: Json
      }
      vendor_name: {
        Args: {
          p_id: string
        }
        Returns: string
      }
    }
    Enums: {
      base_unit: "g" | "ml" | "ea"
      business_close_method: "manual" | "auto"
      business_day_status: "open" | "break" | "closed"
      candidate_reason: "safety_stock" | "soon_out" | "manual"
      candidate_status: "pending" | "ordered" | "excluded"
      category_kind: "ingredient" | "recipe" | "material"
      change_source: "direct" | "inbound" | "ingredient" | "fixed_cost"
      day_basis_quality: "exact" | "estimated_current"
      fixed_cost_mode: "total" | "detail"
      inventory_event_type:
        | "inbound"
        | "consume"
        | "discard"
        | "stocktake"
        | "adjust"
      order_source: "manual" | "ocr" | "option" | "recipe"
      order_status: "ordered" | "partial" | "received" | "canceled"
      stock_badge: "ok" | "low" | "out"
      tax_mode: "included" | "separate" | "exempt"
      trend_cause: "material" | "recipe" | "fixed" | "tax"
    }
    CompositeTypes: {
      sales_business_context: {
        timezone: string | null
        local_date: string | null
        sales_date: string | null
        sales_rule_id: string | null
        open_day_id: string | null
        open_business_date: string | null
        open_status: Database["public"]["Enums"]["business_day_status"] | null
        open_planned_close_at: string | null
        open_rule_id: string | null
        open_expired: boolean | null
      }
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

