export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      officina_utenti: {
        Row: {
          created_at: string;
          officina_id: string;
          profile_id: string;
          ruolo: Database['public']['Enums']['ruolo_officina'];
        };
        Insert: {
          created_at?: string;
          officina_id: string;
          profile_id: string;
          ruolo?: Database['public']['Enums']['ruolo_officina'];
        };
        Update: {
          created_at?: string;
          officina_id?: string;
          profile_id?: string;
          ruolo?: Database['public']['Enums']['ruolo_officina'];
        };
        Relationships: [
          {
            foreignKeyName: 'officina_utenti_officina_id_fkey';
            columns: ['officina_id'];
            isOneToOne: false;
            referencedRelation: 'officine';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'officina_utenti_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      officine: {
        Row: {
          cap: string | null;
          citta: string;
          created_at: string;
          email: string | null;
          id: string;
          indirizzo: string;
          latitudine: number | null;
          longitudine: number | null;
          orari: NonNullable<Json>;
          partita_iva: string;
          provincia: string | null;
          ragione_sociale: string;
          stato_affiliazione: Database['public']['Enums']['stato_affiliazione'];
          telefono: string | null;
          updated_at: string;
        };
        Insert: {
          cap?: string | null;
          citta?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          indirizzo?: string;
          latitudine?: number | null;
          longitudine?: number | null;
          orari?: NonNullable<Json>;
          partita_iva: string;
          provincia?: string | null;
          ragione_sociale: string;
          stato_affiliazione?: Database['public']['Enums']['stato_affiliazione'];
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          cap?: string | null;
          citta?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          indirizzo?: string;
          latitudine?: number | null;
          longitudine?: number | null;
          orari?: NonNullable<Json>;
          partita_iva?: string;
          provincia?: string | null;
          ragione_sociale?: string;
          stato_affiliazione?: Database['public']['Enums']['stato_affiliazione'];
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          cognome: string;
          created_at: string;
          id: string;
          nome: string;
          ruolo: Database['public']['Enums']['ruolo'];
          telefono: string | null;
          updated_at: string;
        };
        Insert: {
          cognome?: string;
          created_at?: string;
          id: string;
          nome?: string;
          ruolo?: Database['public']['Enums']['ruolo'];
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          cognome?: string;
          created_at?: string;
          id?: string;
          nome?: string;
          ruolo?: Database['public']['Enums']['ruolo'];
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_collega: { Args: { p_profile_id: string }; Returns: boolean };
      is_membro_officina: { Args: { p_officina_id: string }; Returns: boolean };
      is_titolare_officina: { Args: { p_officina_id: string }; Returns: boolean };
    };
    Enums: {
      ruolo: 'ADMIN' | 'OFFICINA' | 'CLIENTE';
      ruolo_officina: 'TITOLARE' | 'OPERATORE';
      stato_affiliazione: 'IN_ATTESA' | 'ATTIVA' | 'SOSPESA';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ruolo: ['ADMIN', 'OFFICINA', 'CLIENTE'],
      ruolo_officina: ['TITOLARE', 'OPERATORE'],
      stato_affiliazione: ['IN_ATTESA', 'ATTIVA', 'SOSPESA'],
    },
  },
} as const;
