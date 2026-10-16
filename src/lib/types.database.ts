// Generado desde el esquema real del proyecto Supabase qepfvvfuhbthzmwbfvos.
// Para regenerarlo: usar `generate_typescript_types` del MCP de Supabase o
// `supabase gen types typescript --project-id qepfvvfuhbthzmwbfvos`.
// No editar a mano.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          id?: string
          order_id: string
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          product_name?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: {
          client_name: string
          created_at: string
          id: string
          pdf_url: string | null
          quote_number: string
          total: number
          valid_until: string
        }
        Insert: {
          client_name: string
          created_at?: string
          id?: string
          pdf_url?: string | null
          quote_number?: string
          total?: number
          valid_until?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          id?: string
          pdf_url?: string | null
          quote_number?: string
          total?: number
          valid_until?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          id: string
          is_primary: boolean
          product_id: string | null
          sort_order: number
          url: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          is_primary?: boolean
          product_id?: string | null
          sort_order?: number
          url: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          is_primary?: boolean
          product_id?: string | null
          sort_order?: number
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_images_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
        ]
      }
      product_variants: {
        Row: {
          availability: string
          barcode: string | null
          color: string | null
          created_at: string
          id: string
          origin_id: number | null
          presentation: string | null
          price: number
          product_id: string
          sale_unit: string | null
          size: string | null
          updated_at: string
        }
        Insert: {
          availability?: string
          barcode?: string | null
          color?: string | null
          created_at?: string
          id?: string
          origin_id?: number | null
          presentation?: string | null
          price: number
          product_id: string
          sale_unit?: string | null
          size?: string | null
          updated_at?: string
        }
        Update: {
          availability?: string
          barcode?: string | null
          color?: string | null
          created_at?: string
          id?: string
          origin_id?: number | null
          presentation?: string | null
          price?: number
          product_id?: string
          sale_unit?: string | null
          size?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_bestseller: boolean
          is_offer: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          origin_id: number | null
          search_tags: string[] | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_bestseller?: boolean
          is_offer?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          origin_id?: number | null
          search_tags?: string[] | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_bestseller?: boolean
          is_offer?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          origin_id?: number | null
          search_tags?: string[] | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          image_url: string
          price_label: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          image_url: string
          price_label?: string | null
          start_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          image_url?: string
          price_label?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_limit?: number; p_window_seconds?: number }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      purge_expired_quotes: { Args: never; Returns: undefined }
      search_product_ids: {
        Args: {
          p_query?: string | null
          p_category_ids?: string[] | null
          p_availability?: string | null
          p_only_offers?: boolean
          p_only_bestsellers?: boolean
          p_price_min?: number | null
          p_price_max?: number | null
          p_limit?: number
          p_offset?: number
        }
        Returns: { product_id: string; total: number }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database['public']

export type Tables<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Update']
