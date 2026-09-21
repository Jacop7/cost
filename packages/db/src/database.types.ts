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
      bundle_units: {
        Row: {
          created_at: string
          deleted: boolean
          id: string
          item_unit_name: string
          name: string
          quantity: number
          revision: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          id: string
          item_unit_name?: string
          name: string
          quantity: number
          revision?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          id?: string
          item_unit_name?: string
          name?: string
          quantity?: number
          revision?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_units_store_id_fkey"
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
      channel_tax_remittance: {
        Row: {
          remittance_owner: Database["public"]["Enums"]["tax_remittance_owner"]
          sales_channel_code: Database["public"]["Enums"]["international_sales_channel_code"]
          store_id: string
          tax_component_id: string
        }
        Insert: {
          remittance_owner: Database["public"]["Enums"]["tax_remittance_owner"]
          sales_channel_code: Database["public"]["Enums"]["international_sales_channel_code"]
          store_id: string
          tax_component_id: string
        }
        Update: {
          remittance_owner?: Database["public"]["Enums"]["tax_remittance_owner"]
          sales_channel_code?: Database["public"]["Enums"]["international_sales_channel_code"]
          store_id?: string
          tax_component_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_tax_remittance_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_tax_remittance_tax_component_id_store_id_fkey"
            columns: ["tax_component_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_tax_components"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      daily_sales: {
        Row: {
          business_day_id: string | null
          channel_storage_version: number
          created_at: string
          daily_extra: number
          etc_items: Json
          etc_revenue: number
          etc_tax: number
          etc_tax_calculation_version: Database["public"]["Enums"]["international_tax_calculation_version"]
          etc_tax_snapshot: Json | null
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
          channel_storage_version?: number
          created_at?: string
          daily_extra?: number
          etc_items?: Json
          etc_revenue?: number
          etc_tax?: number
          etc_tax_calculation_version?: Database["public"]["Enums"]["international_tax_calculation_version"]
          etc_tax_snapshot?: Json | null
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
          channel_storage_version?: number
          created_at?: string
          daily_extra?: number
          etc_items?: Json
          etc_revenue?: number
          etc_tax?: number
          etc_tax_calculation_version?: Database["public"]["Enums"]["international_tax_calculation_version"]
          etc_tax_snapshot?: Json | null
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
      daily_sales_etc_lines: {
        Row: {
          channel_code_snapshot: string | null
          channel_name_origin: string
          channel_name_snapshot: string
          created_at: string
          daily_sales_id: string
          id: string
          name_snapshot: string
          quantity: number
          sales_channel_id: string | null
          store_id: string
          tax_snapshot: Json | null
          unit_price: number
        }
        Insert: {
          channel_code_snapshot?: string | null
          channel_name_origin?: string
          channel_name_snapshot: string
          created_at?: string
          daily_sales_id: string
          id: string
          name_snapshot: string
          quantity: number
          sales_channel_id?: string | null
          store_id: string
          tax_snapshot?: Json | null
          unit_price: number
        }
        Update: {
          channel_code_snapshot?: string | null
          channel_name_origin?: string
          channel_name_snapshot?: string
          created_at?: string
          daily_sales_id?: string
          id?: string
          name_snapshot?: string
          quantity?: number
          sales_channel_id?: string | null
          store_id?: string
          tax_snapshot?: Json | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_etc_lines_daily_sales_id_fkey"
            columns: ["daily_sales_id"]
            isOneToOne: false
            referencedRelation: "daily_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_etc_lines_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_etc_lines_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_item_channel_quantities: {
        Row: {
          channel_code_snapshot: string
          channel_name_origin: string
          channel_name_snapshot: string
          created_at: string
          daily_sales_item_id: string
          quantity: number
          sales_channel_id: string
        }
        Insert: {
          channel_code_snapshot: string
          channel_name_origin?: string
          channel_name_snapshot: string
          created_at?: string
          daily_sales_item_id: string
          quantity?: number
          sales_channel_id: string
        }
        Update: {
          channel_code_snapshot?: string
          channel_name_origin?: string
          channel_name_snapshot?: string
          created_at?: string
          daily_sales_item_id?: string
          quantity?: number
          sales_channel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_item_channel_quantities_daily_sales_item_id_fkey"
            columns: ["daily_sales_item_id"]
            isOneToOne: false
            referencedRelation: "daily_sales_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_item_channel_quantities_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_item_channel_tax_snapshots_v2: {
        Row: {
          amount_snapshot: Json
          channel_code_snapshot: string
          channel_name_snapshot: string
          created_at: string
          customer_total: number
          daily_sales_item_id: string
          final_quantity: number
          input_snapshot: Json
          listed_total: number
          marketplace_tax_liability: number
          merchant_tax_liability: number
          net_sales: number
          sales_channel_id: string
          tax_total: number
          updated_at: string
        }
        Insert: {
          amount_snapshot: Json
          channel_code_snapshot: string
          channel_name_snapshot: string
          created_at?: string
          customer_total: number
          daily_sales_item_id: string
          final_quantity: number
          input_snapshot: Json
          listed_total: number
          marketplace_tax_liability?: number
          merchant_tax_liability?: number
          net_sales: number
          sales_channel_id: string
          tax_total: number
          updated_at?: string
        }
        Update: {
          amount_snapshot?: Json
          channel_code_snapshot?: string
          channel_name_snapshot?: string
          created_at?: string
          customer_total?: number
          daily_sales_item_id?: string
          final_quantity?: number
          input_snapshot?: Json
          listed_total?: number
          marketplace_tax_liability?: number
          merchant_tax_liability?: number
          net_sales?: number
          sales_channel_id?: string
          tax_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_item_channel_tax_snapshots_daily_sales_item_id_fkey"
            columns: ["daily_sales_item_id"]
            isOneToOne: false
            referencedRelation: "daily_sales_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_item_channel_tax_snapshots_v2_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_item_tax_component_snapshots: {
        Row: {
          applies_to_treatments: Database["public"]["Enums"]["tax_treatment"][]
          calculation_basis: Database["public"]["Enums"]["tax_calculation_basis"]
          component_id_snapshot: string
          id: string
          jurisdiction_level: Database["public"]["Enums"]["tax_jurisdiction_level"]
          kind: Database["public"]["Enums"]["tax_component_kind"]
          name: string
          rate_pct: number
          remittance_owner: Database["public"]["Enums"]["tax_remittance_owner"]
          rounded_amount: number
          sales_tax_snapshot_id: string
          store_id: string
          unrounded_amount: number
        }
        Insert: {
          applies_to_treatments: Database["public"]["Enums"]["tax_treatment"][]
          calculation_basis: Database["public"]["Enums"]["tax_calculation_basis"]
          component_id_snapshot: string
          id?: string
          jurisdiction_level: Database["public"]["Enums"]["tax_jurisdiction_level"]
          kind: Database["public"]["Enums"]["tax_component_kind"]
          name: string
          rate_pct: number
          remittance_owner: Database["public"]["Enums"]["tax_remittance_owner"]
          rounded_amount: number
          sales_tax_snapshot_id: string
          store_id: string
          unrounded_amount: number
        }
        Update: {
          applies_to_treatments?: Database["public"]["Enums"]["tax_treatment"][]
          calculation_basis?: Database["public"]["Enums"]["tax_calculation_basis"]
          component_id_snapshot?: string
          id?: string
          jurisdiction_level?: Database["public"]["Enums"]["tax_jurisdiction_level"]
          kind?: Database["public"]["Enums"]["tax_component_kind"]
          name?: string
          rate_pct?: number
          remittance_owner?: Database["public"]["Enums"]["tax_remittance_owner"]
          rounded_amount?: number
          sales_tax_snapshot_id?: string
          store_id?: string
          unrounded_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_item_tax_componen_sales_tax_snapshot_id_store__fkey"
            columns: ["sales_tax_snapshot_id", "store_id"]
            isOneToOne: false
            referencedRelation: "daily_sales_item_tax_snapshots"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "daily_sales_item_tax_component_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_item_tax_snapshots: {
        Row: {
          amount_snapshot: Json
          calculation_version: Database["public"]["Enums"]["international_tax_calculation_version"]
          country_code: Database["public"]["Enums"]["international_country_code"]
          created_at: string
          currency_code: Database["public"]["Enums"]["international_currency_code"]
          customer_total: number
          daily_sales_item_id: string
          final_quantity: number
          id: string
          input_snapshot: Json
          listed_total: number
          market_profile_id: string
          market_profile_revision: number
          marketplace_tax_liability: number
          merchant_tax_liability: number
          minor_unit: number
          net_sales: number
          price_basis: Database["public"]["Enums"]["tax_price_basis"]
          region_code: string | null
          sales_channel_code: Database["public"]["Enums"]["international_sales_channel_code"]
          store_id: string
          tax_category: string | null
          tax_profile_id: string
          tax_profile_revision: number
          tax_total: number
          treatment: Database["public"]["Enums"]["tax_treatment"]
          unit_price: number
          updated_at: string
        }
        Insert: {
          amount_snapshot: Json
          calculation_version: Database["public"]["Enums"]["international_tax_calculation_version"]
          country_code: Database["public"]["Enums"]["international_country_code"]
          created_at?: string
          currency_code: Database["public"]["Enums"]["international_currency_code"]
          customer_total: number
          daily_sales_item_id: string
          final_quantity: number
          id?: string
          input_snapshot: Json
          listed_total: number
          market_profile_id: string
          market_profile_revision: number
          marketplace_tax_liability: number
          merchant_tax_liability: number
          minor_unit: number
          net_sales: number
          price_basis: Database["public"]["Enums"]["tax_price_basis"]
          region_code?: string | null
          sales_channel_code: Database["public"]["Enums"]["international_sales_channel_code"]
          store_id: string
          tax_category?: string | null
          tax_profile_id: string
          tax_profile_revision: number
          tax_total: number
          treatment: Database["public"]["Enums"]["tax_treatment"]
          unit_price: number
          updated_at?: string
        }
        Update: {
          amount_snapshot?: Json
          calculation_version?: Database["public"]["Enums"]["international_tax_calculation_version"]
          country_code?: Database["public"]["Enums"]["international_country_code"]
          created_at?: string
          currency_code?: Database["public"]["Enums"]["international_currency_code"]
          customer_total?: number
          daily_sales_item_id?: string
          final_quantity?: number
          id?: string
          input_snapshot?: Json
          listed_total?: number
          market_profile_id?: string
          market_profile_revision?: number
          marketplace_tax_liability?: number
          merchant_tax_liability?: number
          minor_unit?: number
          net_sales?: number
          price_basis?: Database["public"]["Enums"]["tax_price_basis"]
          region_code?: string | null
          sales_channel_code?: Database["public"]["Enums"]["international_sales_channel_code"]
          store_id?: string
          tax_category?: string | null
          tax_profile_id?: string
          tax_profile_revision?: number
          tax_total?: number
          treatment?: Database["public"]["Enums"]["tax_treatment"]
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_item_tax_snapshot_daily_sales_item_id_store_id_fkey"
            columns: ["daily_sales_item_id", "store_id"]
            isOneToOne: false
            referencedRelation: "daily_sales_items"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "daily_sales_item_tax_snapshots_country_code_region_code_fkey"
            columns: ["country_code", "region_code"]
            isOneToOne: false
            referencedRelation: "tax_region_catalog"
            referencedColumns: ["country_code", "region_code"]
          },
          {
            foreignKeyName: "daily_sales_item_tax_snapshots_market_profile_id_store_id_fkey"
            columns: ["market_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_market_profiles"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "daily_sales_item_tax_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_item_tax_snapshots_tax_profile_id_store_id_fkey"
            columns: ["tax_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_tax_profile_contract"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "daily_sales_item_tax_snapshots_tax_profile_id_store_id_fkey"
            columns: ["tax_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_tax_profiles"
            referencedColumns: ["id", "store_id"]
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
          unit_tax_calculation_version: Database["public"]["Enums"]["international_tax_calculation_version"]
          unit_waste_cost: number | null
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
          unit_tax_calculation_version?: Database["public"]["Enums"]["international_tax_calculation_version"]
          unit_waste_cost?: number | null
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
          unit_tax_calculation_version?: Database["public"]["Enums"]["international_tax_calculation_version"]
          unit_waste_cost?: number | null
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
          operation: string | null
          operation_subject_id: string | null
          operation_subject_type: string | null
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
          operation?: string | null
          operation_subject_id?: string | null
          operation_subject_type?: string | null
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
          operation?: string | null
          operation_subject_id?: string | null
          operation_subject_type?: string | null
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
      fixed_cost_item_configurations: {
        Row: {
          effective_month: string
          items: Json
          revision: number
          store_id: string
          updated_at: string
        }
        Insert: {
          effective_month: string
          items?: Json
          revision?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          effective_month?: string
          items?: Json
          revision?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_cost_item_configurations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_cost_reentry_months: {
        Row: {
          items: Json
          month: string
          revision: number
          session_id: string
          total_revenue: number
          updated_at: string
        }
        Insert: {
          items: Json
          month: string
          revision?: number
          session_id: string
          total_revenue: number
          updated_at?: string
        }
        Update: {
          items?: Json
          month?: string
          revision?: number
          session_id?: string
          total_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_cost_reentry_months_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "fixed_cost_reentry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_cost_reentry_sessions: {
        Row: {
          base_configuration_revision: number
          base_settings_revision: number
          basis_months: number
          before_basis_months: number
          before_configurations: Json
          before_items: Json
          before_months: Json
          created_at: string
          finished_at: string | null
          from_month: string
          id: string
          items: Json
          revision: number
          status: string
          store_id: string
          target_month: string
          to_month: string
          updated_at: string
        }
        Insert: {
          base_configuration_revision: number
          base_settings_revision: number
          basis_months: number
          before_basis_months: number
          before_configurations: Json
          before_items: Json
          before_months: Json
          created_at?: string
          finished_at?: string | null
          from_month: string
          id?: string
          items: Json
          revision?: number
          status?: string
          store_id: string
          target_month: string
          to_month: string
          updated_at?: string
        }
        Update: {
          base_configuration_revision?: number
          base_settings_revision?: number
          basis_months?: number
          before_basis_months?: number
          before_configurations?: Json
          before_items?: Json
          before_months?: Json
          created_at?: string
          finished_at?: string | null
          from_month?: string
          id?: string
          items?: Json
          revision?: number
          status?: string
          store_id?: string
          target_month?: string
          to_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_cost_reentry_sessions_store_id_fkey"
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
          cost_scope: string
          created_at: string
          default_vendor_id: string | null
          id: string
          memo: string | null
          menu_unit_price_override: number | null
          min_order_qty: number
          name: string
          per_volume: number
          purchase_price: number | null
          purchase_unit_label: string | null
          safety_stock: number
          safety_stock_is_base: boolean
          stock_tracking: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_unit: Database["public"]["Enums"]["base_unit"]
          category_id?: string | null
          cost_scope?: string
          created_at?: string
          default_vendor_id?: string | null
          id?: string
          memo?: string | null
          menu_unit_price_override?: number | null
          min_order_qty?: number
          name: string
          per_volume: number
          purchase_price?: number | null
          purchase_unit_label?: string | null
          safety_stock?: number
          safety_stock_is_base?: boolean
          stock_tracking?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_unit?: Database["public"]["Enums"]["base_unit"]
          category_id?: string | null
          cost_scope?: string
          created_at?: string
          default_vendor_id?: string | null
          id?: string
          memo?: string | null
          menu_unit_price_override?: number | null
          min_order_qty?: number
          name?: string
          per_volume?: number
          purchase_price?: number | null
          purchase_unit_label?: string | null
          safety_stock?: number
          safety_stock_is_base?: boolean
          stock_tracking?: boolean
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
      international_tax_activation_boundaries: {
        Row: {
          activated_at: string
          activation_date: string
          minimum_app_version: string
          reason: string
          store_id: string
        }
        Insert: {
          activated_at?: string
          activation_date: string
          minimum_app_version: string
          reason: string
          store_id: string
        }
        Update: {
          activated_at?: string
          activation_date?: string
          minimum_app_version?: string
          reason?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "international_tax_activation_boundaries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      international_tax_migration_audits: {
        Row: {
          audited_at: string
          decision: string
          future_effective_from: string | null
          id: string
          legacy_calculation_version: Database["public"]["Enums"]["international_tax_calculation_version"]
          market_profile_id: string | null
          original_future_effective_from: string | null
          reason_codes: string[]
          source_currency: string | null
          source_daily_sales_count: number
          source_etc_revenue_total: number
          source_etc_tax_total: number
          source_locale: string | null
          source_menu_tax_total: number
          source_money_digits: number | null
          source_recipe_mismatch_count: number
          source_sales_item_count: number
          source_tax_items: Json
          source_tax_mode: Database["public"]["Enums"]["tax_mode"] | null
          store_id: string
          tax_profile_id: string | null
        }
        Insert: {
          audited_at?: string
          decision: string
          future_effective_from?: string | null
          id?: string
          legacy_calculation_version?: Database["public"]["Enums"]["international_tax_calculation_version"]
          market_profile_id?: string | null
          original_future_effective_from?: string | null
          reason_codes: string[]
          source_currency?: string | null
          source_daily_sales_count: number
          source_etc_revenue_total: number
          source_etc_tax_total: number
          source_locale?: string | null
          source_menu_tax_total: number
          source_money_digits?: number | null
          source_recipe_mismatch_count: number
          source_sales_item_count: number
          source_tax_items: Json
          source_tax_mode?: Database["public"]["Enums"]["tax_mode"] | null
          store_id: string
          tax_profile_id?: string | null
        }
        Update: {
          audited_at?: string
          decision?: string
          future_effective_from?: string | null
          id?: string
          legacy_calculation_version?: Database["public"]["Enums"]["international_tax_calculation_version"]
          market_profile_id?: string | null
          original_future_effective_from?: string | null
          reason_codes?: string[]
          source_currency?: string | null
          source_daily_sales_count?: number
          source_etc_revenue_total?: number
          source_etc_tax_total?: number
          source_locale?: string | null
          source_menu_tax_total?: number
          source_money_digits?: number | null
          source_recipe_mismatch_count?: number
          source_sales_item_count?: number
          source_tax_items?: Json
          source_tax_mode?: Database["public"]["Enums"]["tax_mode"] | null
          store_id?: string
          tax_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "international_tax_migration_audits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_batches: {
        Row: {
          counted_at: string
          created_at: string
          created_by: string | null
          cutoff_business_date: string
          event_sequence_high_watermark: number
          id: string
          observation_started_at: string
          payload_hash: string
          request_key: string
          session_id: string
          store_id: string
        }
        Insert: {
          counted_at: string
          created_at?: string
          created_by?: string | null
          cutoff_business_date: string
          event_sequence_high_watermark: number
          id?: string
          observation_started_at: string
          payload_hash: string
          request_key: string
          session_id: string
          store_id: string
        }
        Update: {
          counted_at?: string
          created_at?: string
          created_by?: string | null
          cutoff_business_date?: string
          event_sequence_high_watermark?: number
          id?: string
          observation_started_at?: string
          payload_hash?: string
          request_key?: string
          session_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_batches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "inventory_count_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_lines: {
        Row: {
          batch_id: string
          before_quantity: number
          counted_quantity: number
          event_id: string
          ingredient_id: string
        }
        Insert: {
          batch_id: string
          before_quantity: number
          counted_quantity: number
          event_id: string
          ingredient_id: string
        }
        Update: {
          batch_id?: string
          before_quantity?: number
          counted_quantity?: number
          event_id?: string
          ingredient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_count_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_lines_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_lines_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_sessions: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          cutoff_business_date: string
          event_sequence_high_watermark: number
          expires_at: string
          id: string
          invalidation_reason: string | null
          observation_started_at: string
          status: string
          stock_state: Json
          store_id: string
          store_write_revision: number
          target_ingredient_ids: string[]
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cutoff_business_date: string
          event_sequence_high_watermark: number
          expires_at: string
          id: string
          invalidation_reason?: string | null
          observation_started_at: string
          status: string
          stock_state: Json
          store_id: string
          store_write_revision: number
          target_ingredient_ids: string[]
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cutoff_business_date?: string
          event_sequence_high_watermark?: number
          expires_at?: string
          id?: string
          invalidation_reason?: string | null
          observation_started_at?: string
          status?: string
          stock_state?: Json
          store_id?: string
          store_write_revision?: number
          target_ingredient_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_delayed_command_receipts: {
        Row: {
          command_kind: string
          created_at: string
          created_by: string | null
          payload_hash: string
          request_key: string
          result: Json
          store_id: string
        }
        Insert: {
          command_kind: string
          created_at?: string
          created_by?: string | null
          payload_hash: string
          request_key: string
          result: Json
          store_id: string
        }
        Update: {
          command_kind?: string
          created_at?: string
          created_by?: string | null
          payload_hash?: string
          request_key?: string
          result?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_delayed_command_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_event_economic_corrections: {
        Row: {
          correction_event_id: string
          created_at: string
          created_by: string | null
          id: string
          payload_hash: string
          reason: string
          request_key: string
          revision: number
          source_event_id: string
          store_id: string
          target_reported_count_delta: number
          target_volume_delta: number | null
        }
        Insert: {
          correction_event_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          payload_hash: string
          reason: string
          request_key: string
          revision: number
          source_event_id: string
          store_id: string
          target_reported_count_delta: number
          target_volume_delta?: number | null
        }
        Update: {
          correction_event_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          payload_hash?: string
          reason?: string
          request_key?: string
          revision?: number
          source_event_id?: string
          store_id?: string
          target_reported_count_delta?: number
          target_volume_delta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_event_economic_corrections_correction_event_id_fkey"
            columns: ["correction_event_id"]
            isOneToOne: true
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_event_economic_corrections_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_event_economic_corrections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_events: {
        Row: {
          absorbed_by_count_batch_id: string | null
          business_day_id: string | null
          classified_by_count_batch_id: string | null
          count_delta: number | null
          economic_revision: number
          id: string
          idempotency_key: string | null
          ingredient_id: string
          inventory_resolution_kind: string
          note: string | null
          occurred_at: string
          order_record_id: string | null
          reported_count_delta: number | null
          resolved_by_count_batch_id: string | null
          reverses_event_id: string | null
          sales_item_id: string | null
          seq: number
          stock_effect: string
          store_id: string
          type: Database["public"]["Enums"]["inventory_event_type"]
          unit_normalized: boolean
          volume_delta: number | null
          waste: boolean
        }
        Insert: {
          absorbed_by_count_batch_id?: string | null
          business_day_id?: string | null
          classified_by_count_batch_id?: string | null
          count_delta?: number | null
          economic_revision?: number
          id?: string
          idempotency_key?: string | null
          ingredient_id: string
          inventory_resolution_kind?: string
          note?: string | null
          occurred_at?: string
          order_record_id?: string | null
          reported_count_delta?: number | null
          resolved_by_count_batch_id?: string | null
          reverses_event_id?: string | null
          sales_item_id?: string | null
          seq?: number
          stock_effect?: string
          store_id: string
          type: Database["public"]["Enums"]["inventory_event_type"]
          unit_normalized?: boolean
          volume_delta?: number | null
          waste?: boolean
        }
        Update: {
          absorbed_by_count_batch_id?: string | null
          business_day_id?: string | null
          classified_by_count_batch_id?: string | null
          count_delta?: number | null
          economic_revision?: number
          id?: string
          idempotency_key?: string | null
          ingredient_id?: string
          inventory_resolution_kind?: string
          note?: string | null
          occurred_at?: string
          order_record_id?: string | null
          reported_count_delta?: number | null
          resolved_by_count_batch_id?: string | null
          reverses_event_id?: string | null
          sales_item_id?: string | null
          seq?: number
          stock_effect?: string
          store_id?: string
          type?: Database["public"]["Enums"]["inventory_event_type"]
          unit_normalized?: boolean
          volume_delta?: number | null
          waste?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_events_absorbed_by_count_batch_id_fkey"
            columns: ["absorbed_by_count_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_count_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_business_day_id_fkey"
            columns: ["business_day_id"]
            isOneToOne: false
            referencedRelation: "business_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_classified_by_count_batch_id_fkey"
            columns: ["classified_by_count_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_count_batches"
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
            foreignKeyName: "inventory_events_resolved_by_count_batch_id_fkey"
            columns: ["resolved_by_count_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_count_batches"
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
      inventory_recount_targets: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          reason: string
          resolved_at: string | null
          resolved_by_count_batch_id: string | null
          source_event_id: string
          status: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          reason: string
          resolved_at?: string | null
          resolved_by_count_batch_id?: string | null
          source_event_id: string
          status?: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by_count_batch_id?: string | null
          source_event_id?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_recount_targets_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_recount_targets_resolved_by_count_batch_id_fkey"
            columns: ["resolved_by_count_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_count_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_recount_targets_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: true
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_recount_targets_store_id_fkey"
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
      inventory_store_write_state: {
        Row: {
          revision: number
          store_id: string
          updated_at: string
        }
        Insert: {
          revision?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          revision?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_store_write_state_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      material_retirement_archive: {
        Row: {
          archived_at: string
          disposition: string
          id: string
          ingredient_id: string | null
          source_extras: Json
          source_material: Json
          store_id: string
        }
        Insert: {
          archived_at?: string
          disposition: string
          id: string
          ingredient_id?: string | null
          source_extras: Json
          source_material: Json
          store_id: string
        }
        Update: {
          archived_at?: string
          disposition?: string
          id?: string
          ingredient_id?: string | null
          source_extras?: Json
          source_material?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_retirement_archive_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_retirement_archive_store_id_fkey"
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
      menu_tax_overrides: {
        Row: {
          created_at: string
          effective_from: string
          inherit_default: boolean
          recipe_id: string
          revision: number
          store_id: string
          tax_category: string | null
          tax_profile_id: string
          treatment: Database["public"]["Enums"]["tax_treatment"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          inherit_default?: boolean
          recipe_id: string
          revision?: number
          store_id: string
          tax_category?: string | null
          tax_profile_id: string
          treatment?: Database["public"]["Enums"]["tax_treatment"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          inherit_default?: boolean
          recipe_id?: string
          revision?: number
          store_id?: string
          tax_category?: string | null
          tax_profile_id?: string
          treatment?: Database["public"]["Enums"]["tax_treatment"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_tax_overrides_recipe_id_store_id_fkey"
            columns: ["recipe_id", "store_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "menu_tax_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_tax_overrides_tax_profile_id_store_id_fkey"
            columns: ["tax_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_tax_profile_contract"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "menu_tax_overrides_tax_profile_id_store_id_fkey"
            columns: ["tax_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_tax_profiles"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "menu_tax_overrides_tax_profile_id_tax_category_fkey"
            columns: ["tax_profile_id", "tax_category"]
            isOneToOne: false
            referencedRelation: "tax_category_catalog"
            referencedColumns: ["tax_profile_id", "code"]
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
      order_inbound_closed_requests: {
        Row: {
          actor_id: string
          closed_at: string
          order_id: string
          request_key: string
          store_id: string
        }
        Insert: {
          actor_id: string
          closed_at?: string
          order_id: string
          request_key: string
          store_id: string
        }
        Update: {
          actor_id?: string
          closed_at?: string
          order_id?: string
          request_key?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_inbound_closed_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_inbound_closed_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_placement_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          payload: Json
          request_key: string
          result: Json
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          payload: Json
          request_key: string
          result: Json
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          payload?: Json
          request_key?: string
          result?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_placement_receipts_store_id_fkey"
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
      pending_sales_inventory_resolution: {
        Row: {
          base_revision: number
          basis_version_id: string
          created_at: string
          delta: number
          draft_id: string
          id: string
          ingredient_id: string
          line_id: string
          reported_at: string
          resolved_by_count_batch_id: string | null
          status: string
          store_id: string
          target_hash: string
          waste: boolean
        }
        Insert: {
          base_revision: number
          basis_version_id: string
          created_at?: string
          delta: number
          draft_id: string
          id?: string
          ingredient_id: string
          line_id: string
          reported_at: string
          resolved_by_count_batch_id?: string | null
          status?: string
          store_id: string
          target_hash: string
          waste?: boolean
        }
        Update: {
          base_revision?: number
          basis_version_id?: string
          created_at?: string
          delta?: number
          draft_id?: string
          id?: string
          ingredient_id?: string
          line_id?: string
          reported_at?: string
          resolved_by_count_batch_id?: string | null
          status?: string
          store_id?: string
          target_hash?: string
          waste?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pending_sales_inventory_resolut_resolved_by_count_batch_id_fkey"
            columns: ["resolved_by_count_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_count_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_inventory_resolution_basis_version_id_fkey"
            columns: ["basis_version_id"]
            isOneToOne: false
            referencedRelation: "sales_basis_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_inventory_resolution_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "sales_day_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_inventory_resolution_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_inventory_resolution_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      prepared_mutation_commands: {
        Row: {
          command_kind: string
          created_at: string
          expires_at: string
          id: string
          payload: Json
          payload_hash: string
          status: string
          store_id: string
          user_id: string | null
        }
        Insert: {
          command_kind: string
          created_at?: string
          expires_at: string
          id: string
          payload: Json
          payload_hash: string
          status?: string
          store_id: string
          user_id?: string | null
        }
        Update: {
          command_kind?: string
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          payload_hash?: string
          status?: string
          store_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prepared_mutation_commands_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          edit_revision: number
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
          edit_revision?: number
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
          edit_revision?: number
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
      push_device_registrations: {
        Row: {
          active: boolean
          app_version: string
          expo_push_token: string
          installation_id: string
          last_seen_at: string
          platform: string
          registered_at: string
          revoked_at: string | null
          store_id: string
          token_fingerprint: string
          user_id: string
        }
        Insert: {
          active?: boolean
          app_version: string
          expo_push_token: string
          installation_id: string
          last_seen_at?: string
          platform: string
          registered_at?: string
          revoked_at?: string | null
          store_id: string
          token_fingerprint: string
          user_id: string
        }
        Update: {
          active?: boolean
          app_version?: string
          expo_push_token?: string
          installation_id?: string
          last_seen_at?: string
          platform?: string
          registered_at?: string
          revoked_at?: string | null
          store_id?: string
          token_fingerprint?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_device_registrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_inbound_batch_closed_requests: {
        Row: {
          actor_id: string
          closed_at: string
          request_key: string
          store_id: string
        }
        Insert: {
          actor_id: string
          closed_at?: string
          request_key: string
          store_id: string
        }
        Update: {
          actor_id?: string
          closed_at?: string
          request_key?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_inbound_batch_closed_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_inbound_batch_receipts: {
        Row: {
          created_at: string
          created_by: string
          payload: Json
          request_key: string
          result: Json
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          payload: Json
          request_key: string
          result: Json
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          payload?: Json
          request_key?: string
          result?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_inbound_batch_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_inbound_closed_requests: {
        Row: {
          actor_id: string
          closed_at: string
          ingredient_id: string
          request_key: string
          store_id: string
        }
        Insert: {
          actor_id: string
          closed_at?: string
          ingredient_id: string
          request_key: string
          store_id: string
        }
        Update: {
          actor_id?: string
          closed_at?: string
          ingredient_id?: string
          request_key?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_inbound_closed_requests_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_inbound_closed_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      recipe_write_receipts: {
        Row: {
          actor_id: string
          created_at: string
          expected_revision: number | null
          patch: string
          request_fingerprint: Json
          request_id: string
          result_id: string
          store_id: string
          target_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          expected_revision?: number | null
          patch: string
          request_fingerprint: Json
          request_id: string
          result_id: string
          store_id: string
          target_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          expected_revision?: number | null
          patch?: string
          request_fingerprint?: Json
          request_id?: string
          result_id?: string
          store_id?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_write_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          deleted_at: string | null
          deleted_by: string | null
          deletion_base_revision: number | null
          edit_revision: number
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
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_base_revision?: number | null
          edit_revision?: number
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
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_base_revision?: number | null
          edit_revision?: number
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
      sales_basis_authority_clock: {
        Row: {
          current_revision: number
          published_revision: number
          store_id: string
          updated_at: string
        }
        Insert: {
          current_revision?: number
          published_revision?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          current_revision?: number
          published_revision?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_basis_authority_clock_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_basis_publisher_state: {
        Row: {
          processed_at: string
          processed_revision: string
          source_id: string
          source_kind: string
          store_id: string
        }
        Insert: {
          processed_at?: string
          processed_revision: string
          source_id: string
          source_kind: string
          store_id: string
        }
        Update: {
          processed_at?: string
          processed_revision?: string
          source_id?: string
          source_kind?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_basis_publisher_state_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_basis_versions: {
        Row: {
          basis_quality: Database["public"]["Enums"]["sales_basis_quality"]
          created_at: string
          effective_from_business_date: string
          id: string
          manifest: Json
          manifest_sha256: string
          revision: number
          source_clock: number
          store_id: string
        }
        Insert: {
          basis_quality?: Database["public"]["Enums"]["sales_basis_quality"]
          created_at?: string
          effective_from_business_date: string
          id?: string
          manifest: Json
          manifest_sha256: string
          revision: number
          source_clock?: number
          store_id: string
        }
        Update: {
          basis_quality?: Database["public"]["Enums"]["sales_basis_quality"]
          created_at?: string
          effective_from_business_date?: string
          id?: string
          manifest?: Json
          manifest_sha256?: string
          revision?: number
          source_clock?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_basis_versions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_calendar_day_revisions: {
        Row: {
          after_kind: Database["public"]["Enums"]["sales_calendar_day_kind"]
          after_revision: number
          after_source: Database["public"]["Enums"]["sales_calendar_source"]
          before_kind: Database["public"]["Enums"]["sales_calendar_day_kind"]
          before_revision: number
          before_source: Database["public"]["Enums"]["sales_calendar_source"]
          business_date: string
          changed_at: string
          changed_by: string | null
          id: string
          reason: string | null
          store_id: string
        }
        Insert: {
          after_kind: Database["public"]["Enums"]["sales_calendar_day_kind"]
          after_revision: number
          after_source: Database["public"]["Enums"]["sales_calendar_source"]
          before_kind: Database["public"]["Enums"]["sales_calendar_day_kind"]
          before_revision: number
          before_source: Database["public"]["Enums"]["sales_calendar_source"]
          business_date: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          reason?: string | null
          store_id: string
        }
        Update: {
          after_kind?: Database["public"]["Enums"]["sales_calendar_day_kind"]
          after_revision?: number
          after_source?: Database["public"]["Enums"]["sales_calendar_source"]
          before_kind?: Database["public"]["Enums"]["sales_calendar_day_kind"]
          before_revision?: number
          before_source?: Database["public"]["Enums"]["sales_calendar_source"]
          business_date?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          reason?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_calendar_day_revisions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_calendar_days: {
        Row: {
          business_date: string
          created_at: string
          day_kind: Database["public"]["Enums"]["sales_calendar_day_kind"]
          operating_rule_revision: number | null
          revision: number
          scheduled_close_at: string | null
          scheduled_open_at: string | null
          source: Database["public"]["Enums"]["sales_calendar_source"]
          store_id: string
          timezone_id: string
          updated_at: string
        }
        Insert: {
          business_date: string
          created_at?: string
          day_kind: Database["public"]["Enums"]["sales_calendar_day_kind"]
          operating_rule_revision?: number | null
          revision?: number
          scheduled_close_at?: string | null
          scheduled_open_at?: string | null
          source: Database["public"]["Enums"]["sales_calendar_source"]
          store_id: string
          timezone_id: string
          updated_at?: string
        }
        Update: {
          business_date?: string
          created_at?: string
          day_kind?: Database["public"]["Enums"]["sales_calendar_day_kind"]
          operating_rule_revision?: number | null
          revision?: number
          scheduled_close_at?: string | null
          scheduled_open_at?: string | null
          source?: Database["public"]["Enums"]["sales_calendar_source"]
          store_id?: string
          timezone_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_calendar_days_store_id_fkey"
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
          normalized_name: string
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
          normalized_name: string
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
          normalized_name?: string
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
      sales_command_receipts: {
        Row: {
          command_kind: string
          created_at: string
          id: string
          payload_hash: string
          request_key: string
          result: Json
          store_id: string
          user_id: string | null
        }
        Insert: {
          command_kind: string
          created_at?: string
          id?: string
          payload_hash: string
          request_key: string
          result: Json
          store_id: string
          user_id?: string | null
        }
        Update: {
          command_kind?: string
          created_at?: string
          id?: string
          payload_hash?: string
          request_key?: string
          result?: Json
          store_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_command_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_day_drafts: {
        Row: {
          base_ledger_revision: number
          basis_version_id: string
          business_date: string
          channel_storage_version: number
          created_at: string
          discarded_at: string | null
          draft_kind: Database["public"]["Enums"]["sales_draft_kind"]
          draft_revision: number
          expires_at: string
          finalized_at: string | null
          id: string
          last_saved_at: string
          last_saved_by: string | null
          note: string | null
          payload_hash: string
          status: Database["public"]["Enums"]["sales_draft_status"]
          store_id: string
        }
        Insert: {
          base_ledger_revision?: number
          basis_version_id: string
          business_date: string
          channel_storage_version?: number
          created_at?: string
          discarded_at?: string | null
          draft_kind: Database["public"]["Enums"]["sales_draft_kind"]
          draft_revision?: number
          expires_at: string
          finalized_at?: string | null
          id: string
          last_saved_at?: string
          last_saved_by?: string | null
          note?: string | null
          payload_hash: string
          status?: Database["public"]["Enums"]["sales_draft_status"]
          store_id: string
        }
        Update: {
          base_ledger_revision?: number
          basis_version_id?: string
          business_date?: string
          channel_storage_version?: number
          created_at?: string
          discarded_at?: string | null
          draft_kind?: Database["public"]["Enums"]["sales_draft_kind"]
          draft_revision?: number
          expires_at?: string
          finalized_at?: string | null
          id?: string
          last_saved_at?: string
          last_saved_by?: string | null
          note?: string | null
          payload_hash?: string
          status?: Database["public"]["Enums"]["sales_draft_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_day_drafts_basis_version_id_fkey"
            columns: ["basis_version_id"]
            isOneToOne: false
            referencedRelation: "sales_basis_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_day_drafts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_day_heads: {
        Row: {
          business_date: string
          current_version_id: string
          ledger_revision: number
          store_id: string
          updated_at: string
        }
        Insert: {
          business_date: string
          current_version_id: string
          ledger_revision: number
          store_id: string
          updated_at?: string
        }
        Update: {
          business_date?: string
          current_version_id?: string
          ledger_revision?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_day_heads_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "sales_day_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_day_heads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_day_versions: {
        Row: {
          basis_quality: Database["public"]["Enums"]["sales_basis_quality"]
          basis_version_id: string
          business_date: string
          channel_storage_version: number
          customer_total: number
          finalized_at: string
          finalized_by: string | null
          fixed_rate: number | null
          id: string
          net_sales: number
          payload: Json
          source_draft_id: string
          store_id: string
          summary: Json
          version_no: number
        }
        Insert: {
          basis_quality: Database["public"]["Enums"]["sales_basis_quality"]
          basis_version_id: string
          business_date: string
          channel_storage_version?: number
          customer_total: number
          finalized_at?: string
          finalized_by?: string | null
          fixed_rate?: number | null
          id?: string
          net_sales: number
          payload: Json
          source_draft_id: string
          store_id: string
          summary: Json
          version_no: number
        }
        Update: {
          basis_quality?: Database["public"]["Enums"]["sales_basis_quality"]
          basis_version_id?: string
          business_date?: string
          channel_storage_version?: number
          customer_total?: number
          finalized_at?: string
          finalized_by?: string | null
          fixed_rate?: number | null
          id?: string
          net_sales?: number
          payload?: Json
          source_draft_id?: string
          store_id?: string
          summary?: Json
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_day_versions_basis_version_id_fkey"
            columns: ["basis_version_id"]
            isOneToOne: false
            referencedRelation: "sales_basis_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_day_versions_source_draft_id_fkey"
            columns: ["source_draft_id"]
            isOneToOne: true
            referencedRelation: "sales_day_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_day_versions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_draft_channel_manifests: {
        Row: {
          channel_code_snapshot: string
          channel_name_snapshot: string
          draft_id: string
          sales_channel_id: string
          sort_order: number
        }
        Insert: {
          channel_code_snapshot: string
          channel_name_snapshot: string
          draft_id: string
          sales_channel_id: string
          sort_order: number
        }
        Update: {
          channel_code_snapshot?: string
          channel_name_snapshot?: string
          draft_id?: string
          sales_channel_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_draft_channel_manifests_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "sales_day_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_draft_channel_manifests_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_draft_etc_lines: {
        Row: {
          channel: string
          channel_name_snapshot: string | null
          deleted: boolean
          draft_id: string
          id: string
          name: string
          price: number
          qty: number
          sales_channel_id: string | null
          sort_order: number
        }
        Insert: {
          channel: string
          channel_name_snapshot?: string | null
          deleted?: boolean
          draft_id: string
          id: string
          name: string
          price: number
          qty?: number
          sales_channel_id?: string | null
          sort_order?: number
        }
        Update: {
          channel?: string
          channel_name_snapshot?: string | null
          deleted?: boolean
          draft_id?: string
          id?: string
          name?: string
          price?: number
          qty?: number
          sales_channel_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_draft_etc_lines_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "sales_day_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_draft_etc_lines_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_draft_expense_lines: {
        Row: {
          amount: number
          deleted: boolean
          draft_id: string
          id: string
          memo: string | null
          name: string
          sort_order: number
        }
        Insert: {
          amount: number
          deleted?: boolean
          draft_id: string
          id: string
          memo?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          amount?: number
          deleted?: boolean
          draft_id?: string
          id?: string
          memo?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_draft_expense_lines_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "sales_day_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_draft_menu_channel_quantities: {
        Row: {
          draft_menu_line_id: string
          quantity: number
          sales_channel_id: string
        }
        Insert: {
          draft_menu_line_id: string
          quantity?: number
          sales_channel_id: string
        }
        Update: {
          draft_menu_line_id?: string
          quantity?: number
          sales_channel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_draft_menu_channel_quantities_draft_menu_line_id_fkey"
            columns: ["draft_menu_line_id"]
            isOneToOne: false
            referencedRelation: "sales_draft_menu_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_draft_menu_channel_quantities_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_draft_menu_lines: {
        Row: {
          deleted: boolean
          draft_id: string
          id: string
          menu_name: string
          qty_delivery: number
          qty_hall: number
          qty_takeout: number
          qty_waste: number
          recipe_id: string | null
          sort_order: number
        }
        Insert: {
          deleted?: boolean
          draft_id: string
          id: string
          menu_name: string
          qty_delivery?: number
          qty_hall?: number
          qty_takeout?: number
          qty_waste?: number
          recipe_id?: string | null
          sort_order?: number
        }
        Update: {
          deleted?: boolean
          draft_id?: string
          id?: string
          menu_name?: string
          qty_delivery?: number
          qty_hall?: number
          qty_takeout?: number
          qty_waste?: number
          recipe_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_draft_menu_lines_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "sales_day_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_draft_menu_lines_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_inventory_component_offsets: {
        Row: {
          component_id: string
          created_at: string
          id: string
          inventory_event_id: string | null
          quantity: number
          store_id: string
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          inventory_event_id?: string | null
          quantity: number
          store_id: string
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          inventory_event_id?: string | null
          quantity?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_inventory_component_offsets_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "sales_inventory_delta_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_inventory_component_offsets_inventory_event_id_fkey"
            columns: ["inventory_event_id"]
            isOneToOne: false
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_inventory_component_offsets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_inventory_delta_components: {
        Row: {
          absorbed_by_count_batch_id: string | null
          created_at: string
          id: string
          ingredient_id: string
          quantity: number
          resolved_by_count_batch_id: string | null
          sales_item_id: string
          source_event_id: string | null
          source_event_sequence: number
          stock_effect: string
          store_id: string
          waste: boolean
        }
        Insert: {
          absorbed_by_count_batch_id?: string | null
          created_at?: string
          id?: string
          ingredient_id: string
          quantity: number
          resolved_by_count_batch_id?: string | null
          sales_item_id: string
          source_event_id?: string | null
          source_event_sequence: number
          stock_effect: string
          store_id: string
          waste?: boolean
        }
        Update: {
          absorbed_by_count_batch_id?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string
          quantity?: number
          resolved_by_count_batch_id?: string | null
          sales_item_id?: string
          source_event_id?: string | null
          source_event_sequence?: number
          stock_effect?: string
          store_id?: string
          waste?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sales_inventory_delta_component_absorbed_by_count_batch_id_fkey"
            columns: ["absorbed_by_count_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_count_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_inventory_delta_component_resolved_by_count_batch_id_fkey"
            columns: ["resolved_by_count_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_count_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_inventory_delta_components_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_inventory_delta_components_sales_item_id_fkey"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "daily_sales_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_inventory_delta_components_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_inventory_delta_components_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_lifecycle_cutover_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          inventory_event_sequence: number
          inventory_reference_sales_date: string | null
          inventory_write_revision: number
          ledger_state_hash: string
          payload: Json
          payload_hash: string
          phase_revision: number
          previous_receipt_id: string | null
          receipt_kind: string
          source_state_hash: string
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_event_sequence: number
          inventory_reference_sales_date?: string | null
          inventory_write_revision: number
          ledger_state_hash: string
          payload: Json
          payload_hash: string
          phase_revision: number
          previous_receipt_id?: string | null
          receipt_kind: string
          source_state_hash: string
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_event_sequence?: number
          inventory_reference_sales_date?: string | null
          inventory_write_revision?: number
          ledger_state_hash?: string
          payload?: Json
          payload_hash?: string
          phase_revision?: number
          previous_receipt_id?: string | null
          receipt_kind?: string
          source_state_hash?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lifecycle_cutover_receipts_previous_receipt_id_fkey"
            columns: ["previous_receipt_id"]
            isOneToOne: false
            referencedRelation: "sales_lifecycle_cutover_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lifecycle_cutover_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_lifecycle_cutover_state: {
        Row: {
          blocked_reason: string | null
          freeze_receipt_id: string | null
          inventory_reference_sales_date: string | null
          phase: Database["public"]["Enums"]["sales_cutover_phase"]
          planned_freeze_at: string | null
          revision: number
          store_id: string
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          freeze_receipt_id?: string | null
          inventory_reference_sales_date?: string | null
          phase?: Database["public"]["Enums"]["sales_cutover_phase"]
          planned_freeze_at?: string | null
          revision?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          freeze_receipt_id?: string | null
          inventory_reference_sales_date?: string | null
          phase?: Database["public"]["Enums"]["sales_cutover_phase"]
          planned_freeze_at?: string | null
          revision?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lifecycle_cutover_state_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_tax_events: {
        Row: {
          business_day_revision_no: number
          calculation_version: Database["public"]["Enums"]["international_tax_calculation_version"]
          component_id_snapshot: string
          created_at: string
          daily_sales_item_id: string
          delta_amount: number
          id: string
          sales_channel_code: Database["public"]["Enums"]["international_sales_channel_code"]
          store_id: string
          target_quantity: number
        }
        Insert: {
          business_day_revision_no: number
          calculation_version: Database["public"]["Enums"]["international_tax_calculation_version"]
          component_id_snapshot: string
          created_at?: string
          daily_sales_item_id: string
          delta_amount: number
          id?: string
          sales_channel_code: Database["public"]["Enums"]["international_sales_channel_code"]
          store_id: string
          target_quantity: number
        }
        Update: {
          business_day_revision_no?: number
          calculation_version?: Database["public"]["Enums"]["international_tax_calculation_version"]
          component_id_snapshot?: string
          created_at?: string
          daily_sales_item_id?: string
          delta_amount?: number
          id?: string
          sales_channel_code?: Database["public"]["Enums"]["international_sales_channel_code"]
          store_id?: string
          target_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_tax_events_daily_sales_item_id_store_id_fkey"
            columns: ["daily_sales_item_id", "store_id"]
            isOneToOne: false
            referencedRelation: "daily_sales_items"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "sales_tax_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_tax_events_v2: {
        Row: {
          business_day_revision_no: number
          channel_name_snapshot: string
          component_id_snapshot: string | null
          component_name_snapshot: string
          created_at: string
          daily_sales_item_id: string
          delta_amount: number
          id: string
          sales_channel_id: string
          store_id: string
          target_quantity: number
        }
        Insert: {
          business_day_revision_no: number
          channel_name_snapshot: string
          component_id_snapshot?: string | null
          component_name_snapshot: string
          created_at?: string
          daily_sales_item_id: string
          delta_amount: number
          id?: string
          sales_channel_id: string
          store_id: string
          target_quantity: number
        }
        Update: {
          business_day_revision_no?: number
          channel_name_snapshot?: string
          component_id_snapshot?: string | null
          component_name_snapshot?: string
          created_at?: string
          daily_sales_item_id?: string
          delta_amount?: number
          id?: string
          sales_channel_id?: string
          store_id?: string
          target_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_tax_events_v2_daily_sales_item_id_fkey"
            columns: ["daily_sales_item_id"]
            isOneToOne: false
            referencedRelation: "daily_sales_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tax_events_v2_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tax_events_v2_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_version_channel_manifests: {
        Row: {
          channel_code_snapshot: string
          channel_name_snapshot: string
          sales_channel_id: string
          sort_order: number
          version_id: string
        }
        Insert: {
          channel_code_snapshot: string
          channel_name_snapshot: string
          sales_channel_id: string
          sort_order: number
          version_id: string
        }
        Update: {
          channel_code_snapshot?: string
          channel_name_snapshot?: string
          sales_channel_id?: string
          sort_order?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_version_channel_manifests_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_version_channel_manifests_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "sales_day_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          alert_fixed_cost_missing: boolean
          alert_inbound_delay: boolean
          alert_morning_summary: boolean
          alert_negative_stock_check: boolean
          alert_price_spike: boolean
          alert_sales_entry: boolean
          alert_target_miss: boolean
          break_end: string | null
          break_start: string | null
          close_time: string
          cup_volume: number
          currency: string
          default_target_profit_rate: number
          fixed_cost_basis_months: number
          locale: string
          money_digits: number
          open_time: string
          quantity_digits: number
          revision: number
          store_id: string
          tax_items: Json
          tax_mode: Database["public"]["Enums"]["tax_mode"]
          unit_price_digits: number
          unit_system: string
          updated_at: string
        }
        Insert: {
          alert_fixed_cost_missing?: boolean
          alert_inbound_delay?: boolean
          alert_morning_summary?: boolean
          alert_negative_stock_check?: boolean
          alert_price_spike?: boolean
          alert_sales_entry?: boolean
          alert_target_miss?: boolean
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          cup_volume?: number
          currency?: string
          default_target_profit_rate?: number
          fixed_cost_basis_months?: number
          locale?: string
          money_digits?: number
          open_time?: string
          quantity_digits?: number
          revision?: number
          store_id: string
          tax_items?: Json
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          unit_price_digits?: number
          unit_system?: string
          updated_at?: string
        }
        Update: {
          alert_fixed_cost_missing?: boolean
          alert_inbound_delay?: boolean
          alert_morning_summary?: boolean
          alert_negative_stock_check?: boolean
          alert_price_spike?: boolean
          alert_sales_entry?: boolean
          alert_target_miss?: boolean
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          cup_volume?: number
          currency?: string
          default_target_profit_rate?: number
          fixed_cost_basis_months?: number
          locale?: string
          money_digits?: number
          open_time?: string
          quantity_digits?: number
          revision?: number
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
      stock_event_reversal_receipts: {
        Row: {
          created_at: string
          event_id: string
          reversal_event_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          reversal_event_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          reversal_event_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_event_reversal_receipts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_event_reversal_receipts_reversal_event_id_fkey"
            columns: ["reversal_event_id"]
            isOneToOne: true
            referencedRelation: "inventory_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_event_reversal_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_quantity_closed_requests: {
        Row: {
          closed_at: string
          ingredient_id: string
          request_key: string
          store_id: string
        }
        Insert: {
          closed_at?: string
          ingredient_id: string
          request_key: string
          store_id: string
        }
        Update: {
          closed_at?: string
          ingredient_id?: string
          request_key?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_quantity_closed_requests_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quantity_closed_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_quantity_receipts: {
        Row: {
          created_at: string
          payload: Json
          request_key: string
          result: Json
          store_id: string
        }
        Insert: {
          created_at?: string
          payload: Json
          request_key: string
          result: Json
          store_id: string
        }
        Update: {
          created_at?: string
          payload?: Json
          request_key?: string
          result?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_quantity_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_configuration_changes: {
        Row: {
          actor_id: string | null
          after_value: Json
          application_mode: string | null
          before_value: Json | null
          effective_from: string | null
          id: number
          kind: string
          month: string | null
          occurred_at: string
          operation: string | null
          operation_subject_id: string | null
          operation_subject_type: string | null
          source: string
          store_id: string
        }
        Insert: {
          actor_id?: string | null
          after_value: Json
          application_mode?: string | null
          before_value?: Json | null
          effective_from?: string | null
          id?: never
          kind: string
          month?: string | null
          occurred_at?: string
          operation?: string | null
          operation_subject_id?: string | null
          operation_subject_type?: string | null
          source: string
          store_id: string
        }
        Update: {
          actor_id?: string | null
          after_value?: Json
          application_mode?: string | null
          before_value?: Json | null
          effective_from?: string | null
          id?: never
          kind?: string
          month?: string | null
          occurred_at?: string
          operation?: string | null
          operation_subject_id?: string | null
          operation_subject_type?: string | null
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_configuration_changes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_lifecycle_events: {
        Row: {
          actor_user_id: string | null
          approval_reference: string | null
          backup_reference: string | null
          event_type: string
          former_owner_id: string | null
          id: number
          metadata: Json
          occurred_at: string
          reason: string
          store_id: string
        }
        Insert: {
          actor_user_id?: string | null
          approval_reference?: string | null
          backup_reference?: string | null
          event_type: string
          former_owner_id?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          reason: string
          store_id: string
        }
        Update: {
          actor_user_id?: string | null
          approval_reference?: string | null
          backup_reference?: string | null
          event_type?: string
          former_owner_id?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          reason?: string
          store_id?: string
        }
        Relationships: []
      }
      store_market_profiles: {
        Row: {
          business_locale_code: Database["public"]["Enums"]["business_locale_code"]
          country_code: Database["public"]["Enums"]["international_country_code"]
          created_at: string
          created_by: string | null
          currency_code: Database["public"]["Enums"]["international_currency_code"]
          effective_from: string
          effective_to: string | null
          id: string
          price_basis: Database["public"]["Enums"]["tax_price_basis"]
          region_code: string | null
          revision: number
          store_id: string
        }
        Insert: {
          business_locale_code: Database["public"]["Enums"]["business_locale_code"]
          country_code: Database["public"]["Enums"]["international_country_code"]
          created_at?: string
          created_by?: string | null
          currency_code: Database["public"]["Enums"]["international_currency_code"]
          effective_from: string
          effective_to?: string | null
          id?: string
          price_basis: Database["public"]["Enums"]["tax_price_basis"]
          region_code?: string | null
          revision?: number
          store_id: string
        }
        Update: {
          business_locale_code?: Database["public"]["Enums"]["business_locale_code"]
          country_code?: Database["public"]["Enums"]["international_country_code"]
          created_at?: string
          created_by?: string | null
          currency_code?: Database["public"]["Enums"]["international_currency_code"]
          effective_from?: string
          effective_to?: string | null
          id?: string
          price_basis?: Database["public"]["Enums"]["tax_price_basis"]
          region_code?: string | null
          revision?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_market_profiles_country_code_region_code_fkey"
            columns: ["country_code", "region_code"]
            isOneToOne: false
            referencedRelation: "tax_region_catalog"
            referencedColumns: ["country_code", "region_code"]
          },
          {
            foreignKeyName: "store_market_profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_purge_schedules: {
        Row: {
          approval_reference: string
          approved_by: string
          purge_after: string
          reason: string
          scheduled_at: string
          store_id: string
        }
        Insert: {
          approval_reference: string
          approved_by: string
          purge_after: string
          reason: string
          scheduled_at?: string
          store_id: string
        }
        Update: {
          approval_reference?: string
          approved_by?: string
          purge_after?: string
          reason?: string
          scheduled_at?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_purge_schedules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_sales_channel_state: {
        Row: {
          revision: number
          store_id: string
          updated_at: string
        }
        Insert: {
          revision?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          revision?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_sales_channel_state_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_tax_components: {
        Row: {
          applies_to_treatments: Database["public"]["Enums"]["tax_treatment"][]
          calculation_basis: Database["public"]["Enums"]["tax_calculation_basis"]
          config_key: string
          default_remittance_owner: Database["public"]["Enums"]["tax_remittance_owner"]
          id: string
          jurisdiction_level: Database["public"]["Enums"]["tax_jurisdiction_level"]
          kind: Database["public"]["Enums"]["tax_component_kind"]
          name: string
          rate_pct: number
          sort_order: number
          store_id: string
          tax_profile_id: string
        }
        Insert: {
          applies_to_treatments: Database["public"]["Enums"]["tax_treatment"][]
          calculation_basis: Database["public"]["Enums"]["tax_calculation_basis"]
          config_key: string
          default_remittance_owner?: Database["public"]["Enums"]["tax_remittance_owner"]
          id?: string
          jurisdiction_level: Database["public"]["Enums"]["tax_jurisdiction_level"]
          kind: Database["public"]["Enums"]["tax_component_kind"]
          name: string
          rate_pct: number
          sort_order?: number
          store_id: string
          tax_profile_id: string
        }
        Update: {
          applies_to_treatments?: Database["public"]["Enums"]["tax_treatment"][]
          calculation_basis?: Database["public"]["Enums"]["tax_calculation_basis"]
          config_key?: string
          default_remittance_owner?: Database["public"]["Enums"]["tax_remittance_owner"]
          id?: string
          jurisdiction_level?: Database["public"]["Enums"]["tax_jurisdiction_level"]
          kind?: Database["public"]["Enums"]["tax_component_kind"]
          name?: string
          rate_pct?: number
          sort_order?: number
          store_id?: string
          tax_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_tax_components_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_tax_components_tax_profile_id_store_id_fkey"
            columns: ["tax_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_tax_profile_contract"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "store_tax_components_tax_profile_id_store_id_fkey"
            columns: ["tax_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_tax_profiles"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      store_tax_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          default_treatment: Database["public"]["Enums"]["tax_treatment"]
          effective_from: string
          effective_to: string | null
          id: string
          market_profile_id: string
          revision: number
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_treatment: Database["public"]["Enums"]["tax_treatment"]
          effective_from: string
          effective_to?: string | null
          id?: string
          market_profile_id: string
          revision?: number
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_treatment?: Database["public"]["Enums"]["tax_treatment"]
          effective_from?: string
          effective_to?: string | null
          id?: string
          market_profile_id?: string
          revision?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_tax_profiles_market_profile_id_store_id_fkey"
            columns: ["market_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_market_profiles"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "store_tax_profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
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
          archive_note: string | null
          archive_reason: string | null
          archived_at: string | null
          created_at: string
          id: string
          inventory_cutoff_business_date: string
          inventory_recount_required: boolean
          legacy_inventory_cutoff_business_date: string
          name: string
          owner_id: string | null
        }
        Insert: {
          archive_note?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          inventory_cutoff_business_date?: string
          inventory_recount_required?: boolean
          legacy_inventory_cutoff_business_date?: string
          name: string
          owner_id?: string | null
        }
        Update: {
          archive_note?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          inventory_cutoff_business_date?: string
          inventory_recount_required?: boolean
          legacy_inventory_cutoff_business_date?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      tax_category_catalog: {
        Row: {
          active: boolean
          code: string
          id: string
          name: string
          store_id: string
          tax_profile_id: string
          treatment: Database["public"]["Enums"]["tax_treatment"]
        }
        Insert: {
          active?: boolean
          code: string
          id?: string
          name: string
          store_id: string
          tax_profile_id: string
          treatment: Database["public"]["Enums"]["tax_treatment"]
        }
        Update: {
          active?: boolean
          code?: string
          id?: string
          name?: string
          store_id?: string
          tax_profile_id?: string
          treatment?: Database["public"]["Enums"]["tax_treatment"]
        }
        Relationships: [
          {
            foreignKeyName: "tax_category_catalog_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_category_catalog_tax_profile_id_store_id_fkey"
            columns: ["tax_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_tax_profile_contract"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "tax_category_catalog_tax_profile_id_store_id_fkey"
            columns: ["tax_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_tax_profiles"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      tax_region_catalog: {
        Row: {
          active: boolean
          country_code: Database["public"]["Enums"]["international_country_code"]
          jurisdiction_level: Database["public"]["Enums"]["tax_jurisdiction_level"]
          name: string
          parent_region_code: string | null
          region_code: string
        }
        Insert: {
          active?: boolean
          country_code: Database["public"]["Enums"]["international_country_code"]
          jurisdiction_level: Database["public"]["Enums"]["tax_jurisdiction_level"]
          name: string
          parent_region_code?: string | null
          region_code: string
        }
        Update: {
          active?: boolean
          country_code?: Database["public"]["Enums"]["international_country_code"]
          jurisdiction_level?: Database["public"]["Enums"]["tax_jurisdiction_level"]
          name?: string
          parent_region_code?: string | null
          region_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_region_catalog_country_code_parent_region_code_fkey"
            columns: ["country_code", "parent_region_code"]
            isOneToOne: false
            referencedRelation: "tax_region_catalog"
            referencedColumns: ["country_code", "region_code"]
          },
        ]
      }
      user_preferences: {
        Row: {
          app_language: string | null
          created_at: string
          revision: number
          source_locale: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_language?: string | null
          created_at?: string
          revision?: number
          source_locale?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_language?: string | null
          created_at?: string
          revision?: number
          source_locale?: string | null
          updated_at?: string
          user_id?: string
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
      archived_recipe_extra_costs: {
        Row: {
          amount_per_serving: number | null
          id: string | null
          material_id: string | null
          name: string | null
          qty: number | null
          recipe_id: string | null
          store_id: string | null
        }
        Relationships: []
      }
      store_tax_profile_contract: {
        Row: {
          country_code:
            | Database["public"]["Enums"]["international_country_code"]
            | null
          created_at: string | null
          created_by: string | null
          default_treatment: Database["public"]["Enums"]["tax_treatment"] | null
          effective_from: string | null
          effective_to: string | null
          id: string | null
          market_profile_id: string | null
          region_code: string | null
          revision: number | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_market_profiles_country_code_region_code_fkey"
            columns: ["country_code", "region_code"]
            isOneToOne: false
            referencedRelation: "tax_region_catalog"
            referencedColumns: ["country_code", "region_code"]
          },
          {
            foreignKeyName: "store_tax_profiles_market_profile_id_store_id_fkey"
            columns: ["market_profile_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_market_profiles"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "store_tax_profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      active_menu_business_basis: { Args: { p_recipe: string }; Returns: Json }
      add_to_day_basis: {
        Args: {
          p_allow_closed?: boolean
          p_date: string
          p_recipe: string
          p_store: string
        }
        Returns: Json
      }
      amend_ended_business_day: {
        Args: {
          p_base_revision: number
          p_date: string
          p_etc_items?: Json
          p_extra_items?: Json
          p_items?: Json
          p_reason?: string
          p_store: string
        }
        Returns: Json
      }
      app_capabilities: { Args: never; Returns: Json }
      app_version_at_least: {
        Args: { p_actual: string; p_minimum: string }
        Returns: boolean
      }
      applicable_tax_change_items: {
        Args: {
          p_items: Json
          p_treatment: Database["public"]["Enums"]["tax_treatment"]
        }
        Returns: Json
      }
      apply_due_breaks: { Args: never; Returns: Json }
      apply_international_tax_for_daily_sales: {
        Args: { p_sales: string }
        Returns: Json
      }
      apply_international_tax_for_sales_item: {
        Args: { p_force: boolean; p_sales_item: string }
        Returns: Json
      }
      apply_international_tax_for_sales_item_body: {
        Args: { p_force: boolean; p_sales_item: string }
        Returns: Json
      }
      apply_operating_hours: {
        Args: {
          p_base_revision?: number
          p_base_rule_id?: string
          p_store: string
          p_weekly_breaks?: Json
          p_weekly_hours: Json
        }
        Returns: Json
      }
      apply_sale_items: {
        Args: {
          p_allow_closed?: boolean
          p_date: string
          p_etc_items: Json
          p_extra_items: Json
          p_items: Json
          p_sales: string
          p_store: string
        }
        Returns: Json
      }
      archive_my_store: {
        Args: { p_reason: string; p_store: string }
        Returns: Json
      }
      assert_international_tax_write_enabled: {
        Args: never
        Returns: undefined
      }
      assert_my_store: { Args: { p_store: string }; Returns: undefined }
      assert_no_rpc_overloads: { Args: never; Returns: undefined }
      assert_sales_basis_version: {
        Args: {
          p_basis: string
          p_date: string
          p_require_latest: boolean
          p_store: string
        }
        Returns: undefined
      }
      assert_sales_draft_sellable: {
        Args: { p_draft: string; p_store: string }
        Returns: undefined
      }
      assert_tax_items: { Args: { p_items: Json }; Returns: Json }
      assert_weekly_breaks: { Args: { p: Json }; Returns: boolean }
      assert_weekly_hours: { Args: { p: Json }; Returns: boolean }
      assert_weekly_schedule: {
        Args: { p_breaks: Json; p_hours: Json }
        Returns: boolean
      }
      assert_write_app_version: { Args: never; Returns: undefined }
      auto_close_grace: { Args: never; Returns: string }
      base_unit_price: { Args: { p_ingredient: string }; Returns: number }
      begin_inventory_count: {
        Args: { p_session: string; p_store: string }
        Returns: Json
      }
      build_day_snapshot: {
        Args: { p_date: string; p_store: string }
        Returns: Json
      }
      business_day_of: {
        Args: { p_date: string; p_store: string }
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
        SetofOptions: {
          from: "*"
          to: "business_days"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_day_state: { Args: { p_store: string }; Returns: Json }
      business_month: { Args: { p_at?: string }; Returns: string }
      business_tz: { Args: never; Returns: string }
      calculate_international_tax: {
        Args: {
          p_components: Json
          p_listed_total: number
          p_minor_unit: number
          p_price_basis: Database["public"]["Enums"]["tax_price_basis"]
          p_treatment: Database["public"]["Enums"]["tax_treatment"]
        }
        Returns: Json
      }
      cancel_fixed_cost_reentry: {
        Args: { p_base_revision: number; p_session: string; p_store: string }
        Returns: Json
      }
      cancel_inventory_count: {
        Args: { p_session: string; p_store: string }
        Returns: Json
      }
      category_name: { Args: { p_id: string }; Returns: string }
      change_event_json: {
        Args: {
          p_event: Database["public"]["Tables"]["entity_change_events"]["Row"]
        }
        Returns: Json
      }
      change_line: {
        Args: {
          p_after: unknown
          p_before: unknown
          p_key: string
          p_kind?: string
          p_label: string
          p_unit?: string
        }
        Returns: Json
      }
      change_stock_quantity: {
        Args: {
          p_expected_stock: number
          p_idempotency_key: string
          p_ingredient: string
          p_kind: string
          p_note: string
          p_quantity: number
        }
        Returns: Json
      }
      close_business_day: { Args: { p_store: string }; Returns: Json }
      close_business_day_row: {
        Args: {
          p_day_id: string
          p_method: Database["public"]["Enums"]["business_close_method"]
        }
        Returns: Json
      }
      close_due_business_days: { Args: never; Returns: Json }
      close_sales_draft_as_holiday: {
        Args: {
          p_calendar_revision: number
          p_draft: string
          p_draft_revision: number
          p_reason?: string
          p_store: string
        }
        Returns: Json
      }
      commit_inventory_count_batch: {
        Args: {
          p_counts: Json
          p_request_key: string
          p_session: string
          p_store: string
        }
        Returns: Json
      }
      configuration_change_operation_json: {
        Args: {
          p_event: Database["public"]["Tables"]["store_configuration_changes"]["Row"]
        }
        Returns: Json
      }
      consume_stock: {
        Args: {
          p_allow_negative?: boolean
          p_amount: number
          p_ingredient: string
        }
        Returns: number
      }
      correct_absorbed_inventory_event: {
        Args: {
          p_base_revision: number
          p_reason: string
          p_request_key: string
          p_source_event: string
          p_store: string
          p_target_reported_count_delta: number
          p_target_volume_delta: number
        }
        Returns: Json
      }
      create_sales_channel: {
        Args: {
          p_expected_channel_revision: number
          p_name: string
          p_store: string
        }
        Returns: Json
      }
      create_store: {
        Args: { p_name: string; p_timezone?: string }
        Returns: Json
      }
      current_business_day: {
        Args: { p_store: string }
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
        SetofOptions: {
          from: "*"
          to: "business_days"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_client_app_version: { Args: never; Returns: string }
      current_ingredient_unit_price: {
        Args: { p_ingredient: string }
        Returns: number
      }
      current_recipe_tax_quote: {
        Args: { p_date: string; p_recipe: string }
        Returns: Json
      }
      current_tax_settings_date: { Args: { p_store: string }; Returns: string }
      daily_sales_etc_accounting_totals: {
        Args: { p_sales: string }
        Returns: Json
      }
      day_etc_tax_rate: {
        Args: { p_date: string; p_store: string }
        Returns: number
      }
      day_fixed_items: {
        Args: { p_date: string; p_store: string }
        Returns: Json
      }
      day_fixed_rate: {
        Args: { p_date: string; p_store: string }
        Returns: number
      }
      day_fixed_total: {
        Args: { p_date: string; p_store: string }
        Returns: number
      }
      day_ingredient_needs: {
        Args: {
          p_date: string
          p_recipe: string
          p_servings: number
          p_store: string
        }
        Returns: {
          amount: number
          ingredient_id: string
        }[]
      }
      day_menu_basis: {
        Args: { p_date?: string; p_store: string }
        Returns: Json
      }
      day_menu_detail: {
        Args: { p_date: string; p_recipe: string; p_store: string }
        Returns: Json
      }
      day_menu_detail_legacy_0131: {
        Args: { p_date: string; p_recipe: string; p_store: string }
        Returns: Json
      }
      day_recipe_snapshot: {
        Args: { p_date: string; p_recipe: string; p_store: string }
        Returns: Json
      }
      day_revenue: {
        Args: { p_date: string; p_store: string }
        Returns: number
      }
      day_sales_detail: {
        Args: { p_date: string; p_store: string }
        Returns: Json
      }
      day_snapshot: { Args: { p_date: string; p_store: string }; Returns: Json }
      day_stock_needs: {
        Args: {
          p_date: string
          p_recipe: string
          p_servings: number
          p_store: string
        }
        Returns: {
          amount: number
          ingredient_id: string
        }[]
      }
      day_unit_price: {
        Args: { p_date: string; p_ingredient: string; p_store: string }
        Returns: number
      }
      deactivate_ingredient: {
        Args: { p_ingredient: string }
        Returns: undefined
      }
      deactivate_material: { Args: { p_id: string }; Returns: undefined }
      deactivate_push_device: {
        Args: { p_installation_id: string; p_store: string }
        Returns: Json
      }
      deactivate_recipe: { Args: { p_recipe: string }; Returns: undefined }
      default_fixed_cost_configuration: { Args: never; Returns: Json }
      delete_bundle_unit: {
        Args: { p_base_revision: number; p_id: string; p_store: string }
        Returns: Json
      }
      delete_category: { Args: { p_id: string }; Returns: undefined }
      delete_purchase_option: { Args: { p_id: string }; Returns: undefined }
      delete_recipe: {
        Args: { p_expected_revision: string; p_recipe: string; p_store: string }
        Returns: undefined
      }
      delete_sales_channel: {
        Args: {
          p_channel: string
          p_expected_channel_revision: number
          p_store: string
        }
        Returns: Json
      }
      delete_vendor: { Args: { p_id: string }; Returns: undefined }
      discard_delete_days: { Args: never; Returns: number }
      discard_sales_draft: {
        Args: { p_base_revision: number; p_draft: string; p_store: string }
        Returns: Json
      }
      discard_stock_noted: {
        Args: {
          p_ingredient: string
          p_note: string
          p_occurred_at: string
          p_remain_volume: number
        }
        Returns: Json
      }
      e1_confirm_inbound: {
        Args: {
          p_actual_qty?: number
          p_idempotency_key?: string
          p_occurred_at?: string
          p_order: string
        }
        Returns: Json
      }
      e10_sale_recorded: {
        Args: {
          p_allow_closed?: boolean
          p_date: string
          p_qty_delivery?: number
          p_qty_hall?: number
          p_qty_takeout?: number
          p_qty_waste?: number
          p_recipe: string
          p_store: string
        }
        Returns: Json
      }
      e11_inbound_reverted: {
        Args: { p_order: string; p_reason?: string }
        Returns: Json
      }
      e12_order_canceled: {
        Args: { p_order: string; p_reason?: string }
        Returns: Json
      }
      e2_discard: {
        Args: {
          p_ingredient: string
          p_occurred_at?: string
          p_remain_volume: number
        }
        Returns: Json
      }
      e2_discard_reverted: {
        Args: { p_event: string; p_reason?: string }
        Returns: Json
      }
      e3_recipe_saved: {
        Args: { p_occurred_at?: string; p_recipe: string }
        Returns: undefined
      }
      e4_fixed_cost_saved: {
        Args: { p_month: string; p_prev_rate?: number; p_store: string }
        Returns: Json
      }
      e5_stock_adjusted: {
        Args: {
          p_ingredient: string
          p_note?: string
          p_occurred_at?: string
          p_soon: boolean
          p_stock_total: number
        }
        Returns: Json
      }
      e7_place_order: {
        Args: {
          p_amount: number
          p_brand: string
          p_expected: string
          p_ingredient: string
          p_ordered_at?: string
          p_qty: number
          p_source?: Database["public"]["Enums"]["order_source"]
          p_store: string
          p_vendor: string
          p_volume: number
        }
        Returns: string
      }
      e8_sales_consumed: { Args: { p_sales_item: string }; Returns: Json }
      e9_sales_reverted: { Args: { p_sales_item: string }; Returns: Json }
      ensure_sales_calendar_day: {
        Args: { p_date: string; p_store: string }
        Returns: {
          business_date: string
          created_at: string
          day_kind: Database["public"]["Enums"]["sales_calendar_day_kind"]
          operating_rule_revision: number | null
          revision: number
          scheduled_close_at: string | null
          scheduled_open_at: string | null
          source: Database["public"]["Enums"]["sales_calendar_source"]
          store_id: string
          timezone_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "sales_calendar_days"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_sales_calendar_range: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: number
      }
      ensure_sales_inventory_component_baseline: {
        Args: { p_sales_item: string }
        Returns: undefined
      }
      entity_change_history: {
        Args: {
          p_cursor?: string
          p_days?: number
          p_entity_id: string
          p_entity_type: string
          p_limit?: number
          p_store: string
        }
        Returns: Json
      }
      entity_change_operation_json: {
        Args: {
          p_event: Database["public"]["Tables"]["entity_change_events"]["Row"]
        }
        Returns: Json
      }
      entity_change_state: {
        Args: {
          p_event: Database["public"]["Tables"]["entity_change_events"]["Row"]
        }
        Returns: string
      }
      expire_inventory_count_session: {
        Args: { p_store: string }
        Returns: undefined
      }
      expire_sales_drafts: { Args: { p_store: string }; Returns: number }
      finalize_sales_draft: {
        Args: {
          p_base_revision: number
          p_draft: string
          p_payload_hash: string
          p_reason?: string
          p_request_key: string
          p_store: string
        }
        Returns: Json
      }
      finalize_sales_draft_legacy_0129: {
        Args: {
          p_base_revision: number
          p_draft: string
          p_payload_hash: string
          p_reason?: string
          p_request_key: string
          p_store: string
        }
        Returns: Json
      }
      fixed_change_label: { Args: { p_items: Json }; Returns: string }
      fixed_cost_basis_result: {
        Args: { p_month: string; p_store: string }
        Returns: Json
      }
      fixed_cost_change_affected_months: {
        Args: {
          p_event: Database["public"]["Tables"]["store_configuration_changes"]["Row"]
        }
        Returns: string[]
      }
      fixed_cost_change_history: {
        Args: {
          p_cursor?: string
          p_month?: string
          p_scope?: string
          p_store: string
        }
        Returns: Json
      }
      fixed_cost_change_revert_blocker: {
        Args: {
          p_event: Database["public"]["Tables"]["store_configuration_changes"]["Row"]
        }
        Returns: string
      }
      fixed_cost_change_scopes: {
        Args: {
          p_event: Database["public"]["Tables"]["store_configuration_changes"]["Row"]
        }
        Returns: string[]
      }
      fixed_cost_change_type: {
        Args: {
          p_event: Database["public"]["Tables"]["store_configuration_changes"]["Row"]
        }
        Returns: string
      }
      fixed_cost_change_values: {
        Args: {
          p_before: boolean
          p_event: Database["public"]["Tables"]["store_configuration_changes"]["Row"]
        }
        Returns: Json
      }
      fixed_cost_configuration_from_monthly: {
        Args: { p_items: Json }
        Returns: Json
      }
      fixed_cost_configuration_result: {
        Args: { p_month: string; p_store: string }
        Returns: Json
      }
      fixed_cost_items_without_labels: {
        Args: { p_items: Json }
        Returns: Json
      }
      fixed_cost_rate: {
        Args: { p_month: string; p_store: string }
        Returns: number
      }
      fixed_cost_reentry_amounts: {
        Args: { p_items: Json; p_skeleton: Json }
        Returns: Json
      }
      fixed_cost_reentry_json: {
        Args: {
          p_session: Database["public"]["Tables"]["fixed_cost_reentry_sessions"]["Row"]
        }
        Returns: Json
      }
      fixed_cost_revenue_check: {
        Args: { p_month: string; p_store: string }
        Returns: Json
      }
      get_bundle_units: { Args: { p_store: string }; Returns: Json }
      get_fixed_cost_basis: {
        Args: { p_month: string; p_store: string }
        Returns: Json
      }
      get_fixed_cost_configuration: {
        Args: { p_month: string; p_store: string }
        Returns: Json
      }
      get_sales_command_receipt: {
        Args: {
          p_command_kind: string
          p_payload_hash: string
          p_request_key: string
          p_store: string
        }
        Returns: Json
      }
      get_settings: { Args: { p_store: string }; Returns: Json }
      get_user_preferences: { Args: never; Returns: Json }
      ingredient_delete_check: { Args: { p_ingredient: string }; Returns: Json }
      ingredient_detail: { Args: { p_ingredient: string }; Returns: Json }
      ingredient_legacy_material_history: {
        Args: { p_cursor?: string; p_ingredient: string; p_store: string }
        Returns: Json
      }
      ingredient_list: {
        Args: { p_store: string }
        Returns: {
          base_price: number
          base_unit: Database["public"]["Enums"]["base_unit"]
          category_name: string
          id: string
          last_inbound_at: string
          memo: string
          name: string
          per_volume: number
          safety_stock: number
          soon_out: boolean
          stock_total: number
          vendor_name: string
        }[]
      }
      ingredient_list_v2: {
        Args: { p_store: string }
        Returns: {
          base_price: number
          base_unit: Database["public"]["Enums"]["base_unit"]
          category_name: string
          id: string
          last_inbound_at: string
          memo: string
          name: string
          per_volume: number
          safety_stock: number
          soon_out: boolean
          stock_total: number
          stock_tracking: boolean
          vendor_name: string
        }[]
      }
      ingredient_loss: { Args: { p_ingredient: string }; Returns: Json }
      international_currency_minor_unit: {
        Args: {
          p_currency: Database["public"]["Enums"]["international_currency_code"]
        }
        Returns: number
      }
      international_tax_app_state: { Args: { p_store: string }; Returns: Json }
      international_tax_regions: {
        Args: {
          p_country: Database["public"]["Enums"]["international_country_code"]
          p_store: string
        }
        Returns: Json
      }
      international_tax_shadow_compare: {
        Args: { p_date: string; p_store: string }
        Returns: Json
      }
      inventory_event_local_timestamp: {
        Args: {
          p_ingredient: string
          p_local_date: string
          p_local_time: string
        }
        Returns: string
      }
      inventory_event_occurrence_context: {
        Args: { p_ingredient: string }
        Returns: Json
      }
      last_entity_change: {
        Args: { p_entity_id: string; p_entity_type: string; p_store: string }
        Returns: Json
      }
      late_close_at: {
        Args: { p_close: string; p_date: string; p_now: string; p_tz: string }
        Returns: string
      }
      locale_combo_ok: {
        Args: { p_currency: string; p_locale: string; p_money_digits: number }
        Returns: boolean
      }
      locale_defaults: {
        Args: { p_locale: string }
        Returns: {
          currency: string
          money_digits: number
        }[]
      }
      lock_business_scope: { Args: { p_store: string }; Returns: undefined }
      lock_store_write_scope: { Args: { p_store: string }; Returns: undefined }
      money_short: { Args: { p: number }; Returns: string }
      my_store_ids: { Args: never; Returns: string[] }
      next_scheduled_open: {
        Args: { p_after: string; p_store: string }
        Returns: string
      }
      next_unopened_business_date: {
        Args: { p_store: string }
        Returns: string
      }
      normalize_day_times: {
        Args: { p: Json; p_keys: string[] }
        Returns: Json
      }
      normalize_fixed_cost_configuration: {
        Args: { p_items: Json }
        Returns: Json
      }
      normalize_sales_channel_name: {
        Args: { p_name: string }
        Returns: string
      }
      open_business_day: {
        Args: { p_close_time?: string; p_date?: string; p_store: string }
        Returns: Json
      }
      open_sales_draft: {
        Args: { p_date: string; p_draft_id?: string; p_store: string }
        Returns: Json
      }
      operating_hours_status: { Args: { p_store: string }; Returns: Json }
      operating_rule_at: {
        Args: { p_date: string; p_store: string }
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
        SetofOptions: {
          from: "*"
          to: "operating_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ops_health_status: { Args: never; Returns: Json }
      order_board: { Args: { p_store: string }; Returns: Json }
      pending_recipe_tax_quote: { Args: { p_recipe: string }; Returns: Json }
      pending_recipe_tax_quote_for_price: {
        Args: { p_price: number; p_recipe: string }
        Returns: Json
      }
      place_orders: {
        Args: { p_items: Json; p_request_key: string; p_store: string }
        Returns: Json
      }
      planned_close: {
        Args: { p_date: string; p_store: string }
        Returns: string
      }
      profit_delta_cause: {
        Args: {
          p_cur: Database["public"]["Tables"]["profit_trends"]["Row"]
          p_prev: Database["public"]["Tables"]["profit_trends"]["Row"]
        }
        Returns: Json
      }
      profit_event_title: {
        Args: { p_label: string; p_source_type: string }
        Returns: string
      }
      propagate_tax_menu_change: {
        Args: {
          p_before: Json
          p_date: string
          p_recipe?: string
          p_store: string
        }
        Returns: undefined
      }
      publish_sales_basis_version: {
        Args: { p_date: string; p_store: string }
        Returns: {
          basis_quality: Database["public"]["Enums"]["sales_basis_quality"]
          created_at: string
          effective_from_business_date: string
          id: string
          manifest: Json
          manifest_sha256: string
          revision: number
          source_clock: number
          store_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sales_basis_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purchase_history: {
        Args: { p_from?: string; p_ingredient: string; p_to?: string }
        Returns: {
          amount: number
          expected_at: string
          id: string
          ordered_at: string
          qty: number
          received_qty: number
          status: Database["public"]["Enums"]["order_status"]
          unit_price: number
          vendor_name: string
          volume: number
        }[]
      }
      purge_archived_store: {
        Args: { p_backup_reference: string; p_store: string }
        Returns: Json
      }
      purge_entity_changes: { Args: never; Returns: number }
      push_device_registration_status: {
        Args: { p_installation_id: string; p_store: string }
        Returns: Json
      }
      quick_inbound: {
        Args: {
          p_amount: number
          p_idempotency_key?: string
          p_ingredient: string
          p_occurred_at?: string
          p_qty?: number
          p_store: string
          p_vendor?: string
          p_volume: number
        }
        Returns: Json
      }
      quick_inbound_batch_preview: {
        Args: { p_items: Json; p_store: string }
        Returns: Json
      }
      quick_inbound_preview: {
        Args: {
          p_amount: number
          p_ingredient: string
          p_qty?: number
          p_store: string
          p_volume: number
        }
        Returns: Json
      }
      range_menu_detail: {
        Args: {
          p_from: string
          p_recipe: string
          p_store: string
          p_to: string
        }
        Returns: Json
      }
      range_menu_detail_legacy_0131: {
        Args: {
          p_from: string
          p_recipe: string
          p_store: string
          p_to: string
        }
        Returns: Json
      }
      recipe_blocked_by: { Args: { p_recipe: string }; Returns: string }
      recipe_change_state: {
        Args: {
          p_affects: boolean
          p_business_day: string
          p_occurred_at: string
          p_recipe: string
          p_store: string
        }
        Returns: string
      }
      recipe_composition_labels: { Args: { p_recipe: string }; Returns: Json }
      recipe_detail: { Args: { p_recipe: string }; Returns: Json }
      recipe_draft_preview: {
        Args: { p_input: Json; p_store: string }
        Returns: Json
      }
      recipe_draft_preview_internal: {
        Args: { p_input: Json; p_store: string }
        Returns: Json
      }
      recipe_edit_apply_v2: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      recipe_edit_apply_v3: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      recipe_edit_category_delete_v2: {
        Args: { p_id: string }
        Returns: undefined
      }
      recipe_edit_extra_rows_v2: {
        Args: { p_extras: Json }
        Returns: {
          amount_per_serving: number
          material_id: string
          name: string
          qty: number
        }[]
      }
      recipe_edit_extra_rows_v3: {
        Args: { p_extras: Json }
        Returns: {
          amount_per_serving: number
          material_id: string
          name: string
          qty: number
        }[]
      }
      recipe_edit_material_apply_v2: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      recipe_edit_material_apply_v3: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      recipe_edit_shape_v2: {
        Args: { p_body?: Json; p_recipe: string }
        Returns: Json
      }
      recipe_edit_shape_v3: {
        Args: { p_body?: Json; p_recipe: string }
        Returns: Json
      }
      recipe_ingredient_needs: {
        Args: { p_depth?: number; p_recipe: string; p_servings: number }
        Returns: {
          amount: number
          ingredient_id: string
        }[]
      }
      recipe_list: {
        Args: { p_store: string }
        Returns: {
          active: boolean
          avg_monthly_sales: number
          base_servings: number
          blocked_by: string
          category_id: string
          category_name: string
          edit_revision: string
          extra_cost: number
          fixed_cost: number
          id: string
          material_cost: number
          material_rate: number
          name: string
          price: number
          profit: number
          profit_rate: number
          target_profit_rate: number
          tax: number
          tax_mode: Database["public"]["Enums"]["tax_mode"]
          unknown_cost_lines: number
        }[]
      }
      recipe_material_cost: {
        Args: { p_depth?: number; p_recipe: string }
        Returns: number
      }
      recipe_pick_list: {
        Args: { p_exclude?: string; p_store: string }
        Returns: {
          active: boolean
          base_servings: number
          id: string
          name: string
          unit_cost: number
        }[]
      }
      recipe_price_recommendation: {
        Args: { p_recipe: string; p_store: string }
        Returns: Json
      }
      recipe_price_simulation: {
        Args: { p_price: number; p_recipe: string; p_store: string }
        Returns: Json
      }
      recipe_profit_history: {
        Args: {
          p_before?: string
          p_before_id?: string
          p_limit?: number
          p_recipe: string
        }
        Returns: Json
      }
      recipe_shortages: { Args: { p_store: string }; Returns: Json }
      recipe_snapshot_entry: {
        Args: { p_date: string; p_recipe: string }
        Returns: Json
      }
      recipe_tax: { Args: { p_recipe: string }; Returns: number }
      recipe_tax_app_state: {
        Args: { p_recipe: string; p_store: string }
        Returns: Json
      }
      recipe_tax_items: { Args: { p_recipe: string }; Returns: Json }
      recipe_tax_quote_for_price: {
        Args: { p_date: string; p_price: number; p_recipe: string }
        Returns: Json
      }
      recompute_recipe: {
        Args: {
          p_cause: Database["public"]["Enums"]["trend_cause"]
          p_occurred_at?: string
          p_recipe: string
          p_source?: string
        }
        Returns: undefined
      }
      reconcile_sales_consumption: {
        Args: { p_sales_item: string; p_zero?: boolean }
        Returns: Json
      }
      reconcile_sales_consumption_components: {
        Args: { p_sales_item: string; p_zero?: boolean }
        Returns: Json
      }
      record_configuration_change: {
        Args: {
          p_after: Json
          p_before: Json
          p_effective?: string
          p_month: string
          p_source: string
          p_store: string
        }
        Returns: undefined
      }
      record_current_discard: {
        Args: { p_ingredient: string; p_remain_volume: number }
        Returns: Json
      }
      record_current_inbound: {
        Args: { p_actual_qty?: number; p_order: string; p_request_key?: string }
        Returns: Json
      }
      record_current_quick_inbound: {
        Args: {
          p_amount: number
          p_ingredient: string
          p_qty?: number
          p_request_key?: string
          p_store: string
          p_vendor?: string
          p_volume: number
        }
        Returns: Json
      }
      record_current_quick_inbound_batch: {
        Args: { p_items: Json; p_request_key: string; p_store: string }
        Returns: Json
      }
      record_current_stock_adjustment: {
        Args: {
          p_ingredient: string
          p_note?: string
          p_soon_out: boolean
          p_target_quantity: number
        }
        Returns: Json
      }
      record_current_stock_quantity: {
        Args: {
          p_expected_stock: number
          p_idempotency_key: string
          p_ingredient: string
          p_kind: string
          p_note: string
          p_quantity: number
        }
        Returns: Json
      }
      record_delayed_discard: {
        Args: {
          p_discard_quantity: number
          p_ingredient: string
          p_note: string
          p_occurred_at: string
          p_request_key: string
        }
        Returns: Json
      }
      record_delayed_inbound: {
        Args: {
          p_actual_qty: number
          p_occurred_at: string
          p_order: string
          p_request_key: string
        }
        Returns: Json
      }
      record_delayed_quick_inbound: {
        Args: {
          p_amount: number
          p_ingredient: string
          p_occurred_at: string
          p_qty: number
          p_request_key: string
          p_store: string
          p_vendor: string
          p_volume: number
        }
        Returns: Json
      }
      record_delayed_stock_adjustment: {
        Args: {
          p_ingredient: string
          p_note: string
          p_occurred_at: string
          p_quantity_delta: number
          p_request_key: string
          p_soon_out: boolean
        }
        Returns: Json
      }
      record_entity_change: {
        Args: {
          p_affects?: boolean
          p_changes: Json
          p_correlation?: string
          p_entity_id: string
          p_entity_type: string
          p_source: Database["public"]["Enums"]["change_source"]
          p_source_entity?: string
          p_store: string
          p_summary?: string
          p_title: string
        }
        Returns: string
      }
      record_entity_change_operation: {
        Args: {
          p_affects?: boolean
          p_changes: Json
          p_correlation?: string
          p_entity_id: string
          p_entity_type: string
          p_operation: string
          p_source: Database["public"]["Enums"]["change_source"]
          p_source_entity?: string
          p_store: string
          p_subject_id: string
          p_subject_type: string
          p_summary?: string
          p_title: string
        }
        Returns: string
      }
      record_state_transition: {
        Args: {
          p_day: Database["public"]["Tables"]["business_days"]["Row"]
          p_from: Database["public"]["Enums"]["business_day_status"]
          p_method: string
          p_to: Database["public"]["Enums"]["business_day_status"]
        }
        Returns: undefined
      }
      refresh_order_candidate: {
        Args: { p_ingredient: string }
        Returns: undefined
      }
      register_push_device: {
        Args: {
          p_app_version: string
          p_expo_push_token: string
          p_installation_id: string
          p_platform: string
          p_store: string
        }
        Returns: Json
      }
      reorder_categories: {
        Args: { p_ids: string[]; p_store: string }
        Returns: undefined
      }
      report_client_rpc_error: {
        Args: { p_client_platform: string; p_code: string; p_detail: string }
        Returns: Json
      }
      resolve_order_inbound: {
        Args: { p_order: string; p_request_key: string; p_store: string }
        Returns: Json
      }
      resolve_order_placement: {
        Args: { p_request_key: string; p_store: string }
        Returns: Json
      }
      resolve_quick_inbound: {
        Args: { p_ingredient: string; p_request_key: string; p_store: string }
        Returns: Json
      }
      resolve_quick_inbound_batch: {
        Args: { p_request_key: string; p_store: string }
        Returns: Json
      }
      resolve_sales_basis_version: {
        Args: { p_date: string; p_store: string }
        Returns: {
          basis_quality: Database["public"]["Enums"]["sales_basis_quality"]
          created_at: string
          effective_from_business_date: string
          id: string
          manifest: Json
          manifest_sha256: string
          revision: number
          source_clock: number
          store_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sales_basis_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_sales_business_context: {
        Args: { p_at?: string; p_store: string }
        Returns: Database["public"]["CompositeTypes"]["sales_business_context"]
        SetofOptions: {
          from: "*"
          to: "sales_business_context"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_stock_quantity: {
        Args: { p_ingredient: string; p_request_key: string; p_store: string }
        Returns: Json
      }
      restore_sales_channel: {
        Args: {
          p_channel: string
          p_expected_channel_revision: number
          p_store: string
        }
        Returns: Json
      }
      restore_stock: {
        Args: { p_amount: number; p_ingredient: string }
        Returns: number
      }
      restore_tax_override_carry: {
        Args: { p_date: string; p_profile: string; p_rows: Json }
        Returns: undefined
      }
      retire_channel: { Args: { p_id: string }; Returns: undefined }
      retire_my_account: { Args: never; Returns: Json }
      revert_fixed_cost_change: {
        Args: {
          p_change: number
          p_expected_latest_change: number
          p_store: string
        }
        Returns: Json
      }
      revert_fixed_cost_reentry: {
        Args: { p_session: string; p_store: string }
        Returns: Json
      }
      revert_latest_stock_event: { Args: { p_event: string }; Returns: Json }
      rule_hours_on: { Args: { p_date: string; p_rule: string }; Returns: Json }
      sale_date_allowed: {
        Args: { p_date: string; p_store: string }
        Returns: boolean
      }
      sale_shortages: {
        Args: { p_date: string; p_items: Json; p_store: string }
        Returns: Json
      }
      sales_authoritative_channel_profit: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_authoritative_range_detail: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_authoritative_range_detail_base_0121: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_basis_effective_date: {
        Args: { p_at?: string; p_store: string }
        Returns: string
      }
      sales_channel_assert_mutation_allowed: {
        Args: { p_store: string }
        Returns: undefined
      }
      sales_channel_fixed: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_channel_has_reference: {
        Args: { p_channel: string; p_store: string }
        Returns: boolean
      }
      sales_channel_settings: { Args: { p_store: string }; Returns: Json }
      sales_day: { Args: { p_date: string; p_store: string }; Returns: Json }
      sales_day_accounting_summary: {
        Args: { p_date: string; p_fixed_rate: number; p_store: string }
        Returns: Json
      }
      sales_day_read: {
        Args: { p_date: string; p_store: string }
        Returns: Json
      }
      sales_draft_detail: {
        Args: { p_draft: string; p_store: string }
        Returns: Json
      }
      sales_draft_expires_at: {
        Args: { p_date: string; p_store: string }
        Returns: string
      }
      sales_draft_inventory_deltas: {
        Args: { p_draft: string }
        Returns: {
          delta: number
          ingredient_id: string
          line_id: string
          waste: boolean
        }[]
      }
      sales_draft_line_channel_rows: {
        Args: { p_line: string }
        Returns: {
          channel_code: string
          channel_name: string
          quantity: number
          sales_channel_id: string
          sort_order: number
        }[]
      }
      sales_draft_matches_committed: {
        Args: { p_draft: string }
        Returns: boolean
      }
      sales_draft_menu_tax_quote: { Args: { p_draft: string }; Returns: Json }
      sales_draft_payload: { Args: { p_draft: string }; Returns: Json }
      sales_editable_from: {
        Args: { p_at?: string; p_store: string }
        Returns: string
      }
      sales_effective_day_summary: {
        Args: { p_date: string; p_store: string }
        Returns: Json
      }
      sales_etc_by_channel: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_etc_tax_quote: {
        Args: { p_date: string; p_items: Json; p_store: string }
        Returns: Json
      }
      sales_extra_usage: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_feed: {
        Args: {
          p_before?: string
          p_from: string
          p_limit?: number
          p_store: string
          p_to: string
        }
        Returns: Json
      }
      sales_fixed_breakdown: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_inventory_count_requirement: {
        Args: { p_store: string }
        Returns: Json
      }
      sales_item_accounting_totals: { Args: { p_item: string }; Returns: Json }
      sales_item_channel_accounting_rows: {
        Args: { p_item: string }
        Returns: {
          channel_code: string
          channel_name: string
          customer_total: number
          listed_total: number
          marketplace_tax_liability: number
          merchant_tax_liability: number
          net_sales: number
          quantity: number
          sales_channel_id: string
          sort_order: number
          tax_total: number
        }[]
      }
      sales_item_channel_rows: {
        Args: { p_item: string }
        Returns: {
          channel_code: string
          channel_name: string
          quantity: number
          sales_channel_id: string
        }[]
      }
      sales_item_total_quantity: { Args: { p_item: string }; Returns: number }
      sales_json_sha256: { Args: { p_value: Json }; Returns: string }
      sales_lifecycle_assert_legacy_write_allowed: {
        Args: { p_operation: string; p_store: string }
        Returns: undefined
      }
      sales_lifecycle_clock: { Args: { p_store: string }; Returns: Json }
      sales_material_usage: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_normalize_basis_manifest: {
        Args: { p_manifest: Json }
        Returns: Json
      }
      sales_range: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_recommended_date: {
        Args: { p_at?: string; p_store: string }
        Returns: string
      }
      sales_summary: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_tax_app_detail: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_tax_breakdown: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      sales_waste_breakdown: {
        Args: { p_from: string; p_store: string; p_to: string }
        Returns: Json
      }
      save_app_language: {
        Args: { p_base_revision: number; p_language: string }
        Returns: Json
      }
      save_bundle_unit: {
        Args: {
          p_base_revision: number
          p_id: string
          p_item_unit_name?: string
          p_name: string
          p_quantity: number
          p_store: string
        }
        Returns: Json
      }
      save_category: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      save_channel: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      save_fixed_cost_amounts: {
        Args: {
          p_items: Json
          p_month: string
          p_store: string
          p_total_revenue: number
        }
        Returns: Json
      }
      save_fixed_cost_amounts_direct: {
        Args: {
          p_items: Json
          p_month: string
          p_store: string
          p_total_revenue: number
        }
        Returns: Json
      }
      save_fixed_cost_basis: {
        Args: { p_base_revision?: number; p_months: number; p_store: string }
        Returns: Json
      }
      save_fixed_cost_settings: {
        Args: {
          p_base_configuration_revision: number
          p_base_settings_revision: number
          p_items: Json
          p_months: number
          p_store: string
        }
        Returns: Json
      }
      save_fixed_costs: {
        Args: {
          p_items: Json
          p_month: string
          p_store: string
          p_total_revenue: number
        }
        Returns: Json
      }
      save_ingredient: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      save_material: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      save_menu_tax_override: {
        Args: {
          p_base_revision: number
          p_recipe: string
          p_store: string
          p_tax_category: string
          p_tax_profile: string
          p_treatment: Database["public"]["Enums"]["tax_treatment"]
        }
        Returns: Json
      }
      save_purchase_option: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      save_recipe: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      save_sale: {
        Args: {
          p_base_revision?: number
          p_date: string
          p_etc_items?: Json
          p_extra_items?: Json
          p_items: Json
          p_open_close_time?: string
          p_open_day?: boolean
          p_store: string
        }
        Returns: Json
      }
      save_sales_draft: {
        Args: {
          p_base_revision: number
          p_draft: string
          p_etc_items: Json
          p_extra_items: Json
          p_items: Json
          p_store: string
        }
        Returns: Json
      }
      save_settings: {
        Args: { p_base_revision?: number; p_payload: Json; p_store: string }
        Returns: Json
      }
      save_store_market_profile: {
        Args: {
          p_base_profile_id: string
          p_base_revision: number
          p_payload: Json
          p_store: string
        }
        Returns: Json
      }
      save_store_tax: {
        Args: {
          p_base_revision?: number
          p_items: Json
          p_mode: Database["public"]["Enums"]["tax_mode"]
          p_store: string
        }
        Returns: Json
      }
      save_store_tax_profile: {
        Args: {
          p_base_profile_id: string
          p_base_revision: number
          p_payload: Json
          p_store: string
        }
        Returns: Json
      }
      save_tax_configuration: {
        Args: {
          p_market: Json
          p_market_id: string
          p_market_revision: number
          p_store: string
          p_tax: Json
          p_tax_id: string
          p_tax_revision: number
        }
        Returns: Json
      }
      save_vendor: {
        Args: { p_payload: Json; p_store: string }
        Returns: string
      }
      schedule_store_purge: {
        Args: {
          p_approval_reference: string
          p_approved_by: string
          p_purge_after: string
          p_reason: string
          p_store: string
        }
        Returns: Json
      }
      scheduled_open_at: {
        Args: { p_date: string; p_store: string }
        Returns: string
      }
      set_break_row: {
        Args: { p_day_id: string; p_method: string; p_on: boolean }
        Returns: Json
      }
      set_operating_hours: {
        Args: {
          p_base_revision?: number
          p_base_rule_id?: string
          p_store: string
          p_weekly_breaks?: Json
          p_weekly_hours: Json
        }
        Returns: Json
      }
      set_sales_calendar_day: {
        Args: {
          p_base_revision: number
          p_date: string
          p_kind: string
          p_reason?: string
          p_store: string
        }
        Returns: Json
      }
      set_sales_lifecycle_phase: {
        Args: {
          p_expected_revision: number
          p_reason?: string
          p_store: string
          p_target: Database["public"]["Enums"]["sales_cutover_phase"]
        }
        Returns: Json
      }
      set_store_timezone: {
        Args: { p_store: string; p_timezone: string }
        Returns: Json
      }
      settings_lists: { Args: { p_store: string }; Returns: Json }
      stock_history: {
        Args: { p_from?: string; p_ingredient: string; p_to?: string }
        Returns: {
          balance: number
          count_delta: number
          id: string
          note: string
          occurred_on: string
          reverted: boolean
          type: Database["public"]["Enums"]["inventory_event_type"]
          vendor_name: string
          volume_delta: number
          waste: boolean
        }[]
      }
      stock_revert_candidates: {
        Args: { p_ingredient: string }
        Returns: {
          action: string
          eligible: boolean
          event_id: string
        }[]
      }
      stock_total_base: { Args: { p_ingredient: string }; Returns: number }
      store_configuration_history: {
        Args: {
          p_cursor?: string
          p_kind: string
          p_month?: string
          p_store: string
        }
        Returns: Json
      }
      store_has_money_ledger: { Args: { p_store: string }; Returns: boolean }
      store_hours_on: {
        Args: { p_date: string; p_store: string }
        Returns: Json
      }
      store_local_date: {
        Args: { p_at?: string; p_store: string }
        Returns: string
      }
      store_local_month: {
        Args: { p_at?: string; p_store: string }
        Returns: string
      }
      store_tax_rate: { Args: { p_store: string }; Returns: number }
      store_timezone: { Args: { p_store: string }; Returns: string }
      tax_breakdown: {
        Args: {
          p_items: Json
          p_mode: Database["public"]["Enums"]["tax_mode"]
          p_price: number
        }
        Returns: Json
      }
      tax_financial_change_rules: { Args: { p_items: Json }; Returns: Json }
      tax_market_apply_v2: {
        Args: {
          p_base_profile_id: string
          p_base_revision: number
          p_payload: Json
          p_store: string
        }
        Returns: Json
      }
      tax_menu_change_basis: {
        Args: { p_date: string; p_recipe?: string; p_store: string }
        Returns: Json
      }
      tax_of: {
        Args: {
          p_items: Json
          p_mode: Database["public"]["Enums"]["tax_mode"]
          p_price: number
        }
        Returns: number
      }
      tax_override_carry: {
        Args: { p_date: string; p_profile: string }
        Returns: Json
      }
      tax_profile_apply_v2: {
        Args: {
          p_base_profile_id: string
          p_base_revision: number
          p_payload: Json
          p_store: string
        }
        Returns: Json
      }
      tax_profile_payload: { Args: { p_profile: string }; Returns: Json }
      tax_rule_change_label: { Args: { p_rules: Json }; Returns: string }
      transition_business_state: {
        Args: { p_action: string; p_close_time?: string; p_store: string }
        Returns: Json
      }
      validate_quick_inbound_batch: {
        Args: { p_items: Json; p_store: string }
        Returns: undefined
      }
      vendor_name: { Args: { p_id: string }; Returns: string }
      with_effective_menu_detail: { Args: { p_detail: Json }; Returns: Json }
    }
    Enums: {
      base_unit: "g" | "ml" | "ea"
      business_close_method: "manual" | "auto"
      business_day_status: "open" | "break" | "closed"
      business_locale_code: "ko-KR" | "en-US" | "en-GB" | "en-AU" | "en-CA"
      candidate_reason: "safety_stock" | "soon_out" | "manual"
      candidate_status: "pending" | "ordered" | "excluded"
      category_kind: "ingredient" | "recipe" | "material"
      change_source:
        | "direct"
        | "inbound"
        | "ingredient"
        | "fixed_cost"
        | "material"
        | "tax"
      day_basis_quality: "exact" | "estimated_current"
      fixed_cost_mode: "total" | "detail"
      international_country_code: "KR" | "US" | "GB" | "AU" | "CA"
      international_currency_code: "KRW" | "USD" | "GBP" | "AUD" | "CAD"
      international_sales_channel_code: "hall" | "delivery" | "takeout"
      international_tax_calculation_version:
        | "international_tax_v1"
        | "legacy_effective_rate_v1"
      inventory_event_type:
        | "inbound"
        | "consume"
        | "discard"
        | "stocktake"
        | "adjust"
      order_source: "manual" | "ocr" | "option" | "recipe"
      order_status: "ordered" | "partial" | "received" | "canceled"
      sales_basis_quality: "exact" | "legacy_unrecorded" | "estimated_current"
      sales_calendar_day_kind: "expected" | "closed" | "unclassified"
      sales_calendar_source:
        | "operating_rule"
        | "manual_extra"
        | "manual_closed"
        | "migrated_ledger"
        | "migrated_unknown"
      sales_cutover_phase:
        | "legacy_active"
        | "draining"
        | "freezing"
        | "active"
        | "blocked"
      sales_draft_kind: "initial" | "amendment"
      sales_draft_status:
        | "editing"
        | "pending_inventory_resolution"
        | "expired"
        | "discarded"
        | "finalized"
      stock_badge: "ok" | "low" | "out"
      tax_calculation_basis: "primary_tax_exclusive" | "primary_tax_inclusive"
      tax_component_kind: "primary" | "additional"
      tax_jurisdiction_level:
        | "national"
        | "state"
        | "province"
        | "county"
        | "city"
        | "special"
        | "custom"
      tax_mode: "included" | "separate" | "exempt"
      tax_price_basis: "tax_inclusive" | "tax_exclusive"
      tax_remittance_owner: "merchant" | "marketplace"
      tax_treatment: "taxable" | "zero_rated" | "exempt"
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
  public: {
    Enums: {
      base_unit: ["g", "ml", "ea"],
      business_close_method: ["manual", "auto"],
      business_day_status: ["open", "break", "closed"],
      business_locale_code: ["ko-KR", "en-US", "en-GB", "en-AU", "en-CA"],
      candidate_reason: ["safety_stock", "soon_out", "manual"],
      candidate_status: ["pending", "ordered", "excluded"],
      category_kind: ["ingredient", "recipe", "material"],
      change_source: [
        "direct",
        "inbound",
        "ingredient",
        "fixed_cost",
        "material",
        "tax",
      ],
      day_basis_quality: ["exact", "estimated_current"],
      fixed_cost_mode: ["total", "detail"],
      international_country_code: ["KR", "US", "GB", "AU", "CA"],
      international_currency_code: ["KRW", "USD", "GBP", "AUD", "CAD"],
      international_sales_channel_code: ["hall", "delivery", "takeout"],
      international_tax_calculation_version: [
        "international_tax_v1",
        "legacy_effective_rate_v1",
      ],
      inventory_event_type: [
        "inbound",
        "consume",
        "discard",
        "stocktake",
        "adjust",
      ],
      order_source: ["manual", "ocr", "option", "recipe"],
      order_status: ["ordered", "partial", "received", "canceled"],
      sales_basis_quality: ["exact", "legacy_unrecorded", "estimated_current"],
      sales_calendar_day_kind: ["expected", "closed", "unclassified"],
      sales_calendar_source: [
        "operating_rule",
        "manual_extra",
        "manual_closed",
        "migrated_ledger",
        "migrated_unknown",
      ],
      sales_cutover_phase: [
        "legacy_active",
        "draining",
        "freezing",
        "active",
        "blocked",
      ],
      sales_draft_kind: ["initial", "amendment"],
      sales_draft_status: [
        "editing",
        "pending_inventory_resolution",
        "expired",
        "discarded",
        "finalized",
      ],
      stock_badge: ["ok", "low", "out"],
      tax_calculation_basis: ["primary_tax_exclusive", "primary_tax_inclusive"],
      tax_component_kind: ["primary", "additional"],
      tax_jurisdiction_level: [
        "national",
        "state",
        "province",
        "county",
        "city",
        "special",
        "custom",
      ],
      tax_mode: ["included", "separate", "exempt"],
      tax_price_basis: ["tax_inclusive", "tax_exclusive"],
      tax_remittance_owner: ["merchant", "marketplace"],
      tax_treatment: ["taxable", "zero_rated", "exempt"],
      trend_cause: ["material", "recipe", "fixed", "tax"],
    },
  },
} as const

