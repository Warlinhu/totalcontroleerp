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
      app_releases: {
        Row: {
          category: Database["public"]["Enums"]["release_category"]
          created_at: string
          details: string | null
          id: string
          published_at: string
          summary: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["release_category"]
          created_at?: string
          details?: string | null
          id?: string
          published_at?: string
          summary: string
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          category?: Database["public"]["Enums"]["release_category"]
          created_at?: string
          details?: string | null
          id?: string
          published_at?: string
          summary?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          currency: string
          first_month_discount_pct: number
          id: string
          monthly_price_cents: number
          name: string
          updated_at: string
          yearly_discount_pct: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          currency?: string
          first_month_discount_pct?: number
          id?: string
          monthly_price_cents: number
          name: string
          updated_at?: string
          yearly_discount_pct?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          currency?: string
          first_month_discount_pct?: number
          id?: string
          monthly_price_cents?: number
          name?: string
          updated_at?: string
          yearly_discount_pct?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          created_by: string
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["company_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["company_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["company_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      debtor_installments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          debtor_id: string
          due_date: string
          id: string
          paid_at: string | null
          sequence: number
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          debtor_id: string
          due_date: string
          id?: string
          paid_at?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          debtor_id?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtor_installments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtor_installments_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
        ]
      }
      debtors: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          document: string | null
          id: string
          name: string
          notes: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          document?: string | null
          id?: string
          name: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          document?: string | null
          id?: string
          name?: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtors_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          hired_at: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role_title: string | null
          salary: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          hired_at?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role_title?: string | null
          salary?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          hired_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role_title?: string | null
          salary?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          company_id: string | null
          context: Json | null
          created_at: string
          fingerprint: string
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          severity: Database["public"]["Enums"]["error_severity"]
          source: string
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          context?: Json | null
          created_at?: string
          fingerprint: string
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: Database["public"]["Enums"]["error_severity"]
          source?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          context?: Json | null
          created_at?: string
          fingerprint?: string
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: Database["public"]["Enums"]["error_severity"]
          source?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      error_notifications: {
        Row: {
          fingerprint: string
          last_notified_at: string
          notify_count: number
        }
        Insert: {
          fingerprint: string
          last_notified_at?: string
          notify_count?: number
        }
        Update: {
          fingerprint?: string
          last_notified_at?: string
          notify_count?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          access_key: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_document: string | null
          customer_id: string | null
          customer_name: string
          id: string
          issue_date: string
          nfe_number: string
          nfe_series: string | null
          notes: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          tax_amount: number
          total_amount: number
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_document?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          issue_date?: string
          nfe_number: string
          nfe_series?: string | null
          notes?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_document?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          issue_date?: string
          nfe_number?: string
          nfe_series?: string | null
          notes?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          amount_cents: number
          code: string
          created_at: string
          created_by: string
          currency: string
          duration_days: number
          id: string
          notes: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          status: Database["public"]["Enums"]["license_status"]
          target_email: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          code: string
          created_at?: string
          created_by: string
          currency?: string
          duration_days: number
          id?: string
          notes?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          target_email?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          code?: string
          created_at?: string
          created_by?: string
          currency?: string
          duration_days?: number
          id?: string
          notes?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          target_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payable_installments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          due_date: string
          id: string
          paid_at: string | null
          payable_id: string
          sequence: number
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          due_date: string
          id?: string
          paid_at?: string | null
          payable_id: string
          sequence?: number
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          payable_id?: string
          sequence?: number
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payable_installments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_installments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          company_id: string
          created_at: string
          description: string
          id: string
          notes: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          cycle: Database["public"]["Enums"]["subscription_cycle"]
          external_id: string | null
          id: string
          method: string | null
          paid_at: string | null
          provider: string
          raw: Json | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          cycle?: Database["public"]["Enums"]["subscription_cycle"]
          external_id?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          provider?: string
          raw?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          cycle?: Database["public"]["Enums"]["subscription_cycle"]
          external_id?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          provider?: string
          raw?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_expenses: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          created_by: string
          deductible: boolean
          description: string
          id: string
          incurred_on: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category?: string
          created_at?: string
          created_by: string
          deductible?: boolean
          description: string
          id?: string
          incurred_on?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          created_by?: string
          deductible?: boolean
          description?: string
          id?: string
          incurred_on?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["product_kind"]
          name: string
          price: number
          sku: string | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["product_kind"]
          name: string
          price?: number
          sku?: string | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["product_kind"]
          name?: string
          price?: number
          sku?: string | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          company_id: string
          created_at: string
          description: string
          discount: number
          id: string
          product_id: string | null
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description: string
          discount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          discount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          debtor_installment_id: string | null
          id: string
          method: Database["public"]["Enums"]["sale_payment_method"]
          sale_id: string
          settled_at: string | null
          status: Database["public"]["Enums"]["sale_payment_status"]
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          debtor_installment_id?: string | null
          id?: string
          method: Database["public"]["Enums"]["sale_payment_method"]
          sale_id: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["sale_payment_status"]
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          debtor_installment_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["sale_payment_method"]
          sale_id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["sale_payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_debtor_installment_id_fkey"
            columns: ["debtor_installment_id"]
            isOneToOne: false
            referencedRelation: "debtor_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          discount: number
          id: string
          notes: string | null
          sold_at: string
          sold_by: string | null
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          sold_at?: string
          sold_by?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          sold_at?: string
          sold_by?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          cycle: Database["public"]["Enums"]["subscription_cycle"]
          first_month_discount_used: boolean
          id: string
          last_amount_cents: number | null
          source: Database["public"]["Enums"]["subscription_source"]
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          cycle?: Database["public"]["Enums"]["subscription_cycle"]
          first_month_discount_used?: boolean
          id?: string
          last_amount_cents?: number | null
          source?: Database["public"]["Enums"]["subscription_source"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          cycle?: Database["public"]["Enums"]["subscription_cycle"]
          first_month_discount_used?: boolean
          id?: string
          last_amount_cents?: number | null
          source?: Database["public"]["Enums"]["subscription_source"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_admin_reply: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string
          id: string
          module: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          company_id: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          module?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          module?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_brackets: {
        Row: {
          annual_limit_cents: number
          created_at: string
          deduction_cents: number
          id: string
          label: string
          rate_pct: number
          regime: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          annual_limit_cents: number
          created_at?: string
          deduction_cents?: number
          id?: string
          label: string
          rate_pct: number
          regime: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          annual_limit_cents?: number
          created_at?: string
          deduction_cents?: number
          id?: string
          label?: string
          rate_pct?: number
          regime?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_release_reads: {
        Row: {
          read_at: string
          release_id: string
          user_id: string
        }
        Insert: {
          read_at?: string
          release_id: string
          user_id: string
        }
        Update: {
          read_at?: string
          release_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_release_reads_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "app_releases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_company_invite: { Args: { _token: string }; Returns: string }
      find_user_by_email: {
        Args: { _email: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_company_role: {
        Args: { _company_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["company_role"]
      }
      grant_platform_admin: { Args: { _user_id: string }; Returns: undefined }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_company_manage: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      list_platform_admins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          user_id: string
        }[]
      }
      platform_company_overview: {
        Args: never
        Returns: {
          created_at: string
          document: string
          email: string
          id: string
          member_count: number
          name: string
          open_errors: number
          open_tickets: number
          owner_email: string
          phone: string
          suspended_at: string
        }[]
      }
      platform_delete_company: {
        Args: { _company_id: string }
        Returns: undefined
      }
      platform_suspend_company: {
        Args: { _company_id: string }
        Returns: undefined
      }
      platform_ticket_stats: {
        Args: never
        Returns: {
          critical_open: number
          in_progress_count: number
          open_count: number
          resolved_count: number
          total: number
          waiting_customer_count: number
        }[]
      }
      platform_unsuspend_company: {
        Args: { _company_id: string }
        Returns: undefined
      }
      redeem_license: { Args: { _code: string }; Returns: string }
      revoke_platform_admin: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      company_role: "owner" | "admin" | "employee"
      error_severity: "info" | "warning" | "error" | "critical"
      installment_status: "pending" | "paid" | "overdue" | "canceled"
      invoice_status: "issued" | "cancelled"
      license_status: "unused" | "redeemed" | "revoked"
      payment_status:
        | "pending"
        | "approved"
        | "rejected"
        | "refunded"
        | "cancelled"
      product_kind: "product" | "service"
      release_category: "bugfix" | "feature" | "melhoria"
      sale_payment_method:
        | "dinheiro"
        | "credito"
        | "debito"
        | "pix"
        | "alimentacao"
        | "voucher"
        | "nota"
      sale_payment_status: "settled" | "pending"
      subscription_cycle: "monthly" | "yearly"
      subscription_source: "mercadopago" | "manual" | "license"
      subscription_status: "pending" | "active" | "past_due" | "canceled"
      ticket_priority: "low" | "medium" | "high" | "critical"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
      ticket_type: "bug" | "feature" | "change" | "question"
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
  public: {
    Enums: {
      company_role: ["owner", "admin", "employee"],
      error_severity: ["info", "warning", "error", "critical"],
      installment_status: ["pending", "paid", "overdue", "canceled"],
      invoice_status: ["issued", "cancelled"],
      license_status: ["unused", "redeemed", "revoked"],
      payment_status: [
        "pending",
        "approved",
        "rejected",
        "refunded",
        "cancelled",
      ],
      product_kind: ["product", "service"],
      release_category: ["bugfix", "feature", "melhoria"],
      sale_payment_method: [
        "dinheiro",
        "credito",
        "debito",
        "pix",
        "alimentacao",
        "voucher",
        "nota",
      ],
      sale_payment_status: ["settled", "pending"],
      subscription_cycle: ["monthly", "yearly"],
      subscription_source: ["mercadopago", "manual", "license"],
      subscription_status: ["pending", "active", "past_due", "canceled"],
      ticket_priority: ["low", "medium", "high", "critical"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
      ticket_type: ["bug", "feature", "change", "question"],
    },
  },
} as const
