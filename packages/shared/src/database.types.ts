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
      clienti_officina: {
        Row: {
          codice_gestionale: string | null;
          cognome: string;
          consenso_marketing: boolean;
          created_at: string;
          email: string | null;
          id: string;
          nome: string;
          note: string;
          officina_id: string;
          origine: Database['public']['Enums']['origine_dato'];
          profile_id: string | null;
          ragione_sociale: string | null;
          telefono: string | null;
          updated_at: string;
        };
        Insert: {
          codice_gestionale?: string | null;
          cognome?: string;
          consenso_marketing?: boolean;
          created_at?: string;
          email?: string | null;
          id?: string;
          nome?: string;
          note?: string;
          officina_id: string;
          origine?: Database['public']['Enums']['origine_dato'];
          profile_id?: string | null;
          ragione_sociale?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          codice_gestionale?: string | null;
          cognome?: string;
          consenso_marketing?: boolean;
          created_at?: string;
          email?: string | null;
          id?: string;
          nome?: string;
          note?: string;
          officina_id?: string;
          origine?: Database['public']['Enums']['origine_dato'];
          profile_id?: string | null;
          ragione_sociale?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'clienti_officina_officina_id_fkey';
            columns: ['officina_id'];
            isOneToOne: false;
            referencedRelation: 'officine';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clienti_officina_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      controlli: {
        Row: {
          codice_documento: string | null;
          created_at: string;
          eseguito_da: string | null;
          eseguito_il: string;
          id: string;
          km: number | null;
          note: string;
          officina_id: string;
          origine: Database['public']['Enums']['origine_dato'];
          updated_at: string;
          veicolo_id: string;
        };
        Insert: {
          codice_documento?: string | null;
          created_at?: string;
          eseguito_da?: string | null;
          eseguito_il?: string;
          id?: string;
          km?: number | null;
          note?: string;
          officina_id: string;
          origine?: Database['public']['Enums']['origine_dato'];
          updated_at?: string;
          veicolo_id: string;
        };
        Update: {
          codice_documento?: string | null;
          created_at?: string;
          eseguito_da?: string | null;
          eseguito_il?: string;
          id?: string;
          km?: number | null;
          note?: string;
          officina_id?: string;
          origine?: Database['public']['Enums']['origine_dato'];
          updated_at?: string;
          veicolo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'controlli_eseguito_da_fkey';
            columns: ['eseguito_da'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'controlli_veicolo_id_officina_id_fkey';
            columns: ['veicolo_id', 'officina_id'];
            isOneToOne: false;
            referencedRelation: 'veicoli';
            referencedColumns: ['id', 'officina_id'];
          },
        ];
      };
      misure_pneumatico: {
        Row: {
          battistrada_mm: number;
          controllo_id: string;
          created_at: string;
          danni: string;
          officina_id: string;
          pneumatico_id: string;
          pressione_bar: number | null;
          usura: Database['public']['Enums']['usura'] | null;
          veicolo_id: string;
        };
        Insert: {
          battistrada_mm: number;
          controllo_id: string;
          created_at?: string;
          danni?: string;
          officina_id: string;
          pneumatico_id: string;
          pressione_bar?: number | null;
          usura?: Database['public']['Enums']['usura'] | null;
          veicolo_id: string;
        };
        Update: {
          battistrada_mm?: number;
          controllo_id?: string;
          created_at?: string;
          danni?: string;
          officina_id?: string;
          pneumatico_id?: string;
          pressione_bar?: number | null;
          usura?: Database['public']['Enums']['usura'] | null;
          veicolo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'misure_pneumatico_controllo_id_veicolo_id_fkey';
            columns: ['controllo_id', 'veicolo_id'];
            isOneToOne: false;
            referencedRelation: 'controlli';
            referencedColumns: ['id', 'veicolo_id'];
          },
          {
            foreignKeyName: 'misure_pneumatico_pneumatico_id_veicolo_id_fkey';
            columns: ['pneumatico_id', 'veicolo_id'];
            isOneToOne: false;
            referencedRelation: 'pneumatici';
            referencedColumns: ['id', 'veicolo_id'];
          },
          {
            foreignKeyName: 'misure_pneumatico_veicolo_id_officina_id_fkey';
            columns: ['veicolo_id', 'officina_id'];
            isOneToOne: false;
            referencedRelation: 'veicoli';
            referencedColumns: ['id', 'officina_id'];
          },
        ];
      };
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
      pneumatici: {
        Row: {
          created_at: string;
          dot: string | null;
          id: string;
          marca: string;
          misura: string;
          modello: string;
          montato_il: string;
          officina_id: string;
          origine: Database['public']['Enums']['origine_dato'];
          posizione: Database['public']['Enums']['posizione_pneumatico'];
          smontato_il: string | null;
          stagione: Database['public']['Enums']['stagione'];
          updated_at: string;
          veicolo_id: string;
        };
        Insert: {
          created_at?: string;
          dot?: string | null;
          id?: string;
          marca?: string;
          misura?: string;
          modello?: string;
          montato_il?: string;
          officina_id: string;
          origine?: Database['public']['Enums']['origine_dato'];
          posizione: Database['public']['Enums']['posizione_pneumatico'];
          smontato_il?: string | null;
          stagione: Database['public']['Enums']['stagione'];
          updated_at?: string;
          veicolo_id: string;
        };
        Update: {
          created_at?: string;
          dot?: string | null;
          id?: string;
          marca?: string;
          misura?: string;
          modello?: string;
          montato_il?: string;
          officina_id?: string;
          origine?: Database['public']['Enums']['origine_dato'];
          posizione?: Database['public']['Enums']['posizione_pneumatico'];
          smontato_il?: string | null;
          stagione?: Database['public']['Enums']['stagione'];
          updated_at?: string;
          veicolo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pneumatici_veicolo_id_officina_id_fkey';
            columns: ['veicolo_id', 'officina_id'];
            isOneToOne: false;
            referencedRelation: 'veicoli';
            referencedColumns: ['id', 'officina_id'];
          },
        ];
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
      veicoli: {
        Row: {
          anno: number | null;
          cliente_officina_id: string | null;
          created_at: string;
          id: string;
          marca: string;
          modello: string;
          officina_id: string;
          origine: Database['public']['Enums']['origine_dato'];
          targa: string;
          telaio: string | null;
          updated_at: string;
        };
        Insert: {
          anno?: number | null;
          cliente_officina_id?: string | null;
          created_at?: string;
          id?: string;
          marca?: string;
          modello?: string;
          officina_id: string;
          origine?: Database['public']['Enums']['origine_dato'];
          targa: string;
          telaio?: string | null;
          updated_at?: string;
        };
        Update: {
          anno?: number | null;
          cliente_officina_id?: string | null;
          created_at?: string;
          id?: string;
          marca?: string;
          modello?: string;
          officina_id?: string;
          origine?: Database['public']['Enums']['origine_dato'];
          targa?: string;
          telaio?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'veicoli_cliente_officina_id_officina_id_fkey';
            columns: ['cliente_officina_id', 'officina_id'];
            isOneToOne: false;
            referencedRelation: 'clienti_officina';
            referencedColumns: ['id', 'officina_id'];
          },
          {
            foreignKeyName: 'veicoli_officina_id_fkey';
            columns: ['officina_id'];
            isOneToOne: false;
            referencedRelation: 'officine';
            referencedColumns: ['id'];
          },
        ];
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
      is_veicolo_mio: { Args: { p_veicolo_id: string }; Returns: boolean };
      modifica_controllo: {
        Args: {
          p_eseguito_il: string;
          p_id: string;
          p_km?: number;
          p_misure: Json;
          p_note?: string;
        };
        Returns: undefined;
      };
      monta_pneumatici: {
        Args: { p_montato_il?: string; p_pneumatici: Json; p_veicolo_id: string };
        Returns: string[];
      };
      registra_controllo: {
        Args: {
          p_eseguito_il?: string;
          p_id?: string;
          p_km?: number;
          p_misure: Json;
          p_note?: string;
          p_veicolo_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      origine_dato: 'APP' | 'IMPORT';
      posizione_pneumatico: 'ANT_SX' | 'ANT_DX' | 'POST_SX' | 'POST_DX' | 'SCORTA';
      ruolo: 'ADMIN' | 'OFFICINA' | 'CLIENTE';
      ruolo_officina: 'TITOLARE' | 'OPERATORE';
      stagione: 'ESTIVO' | 'INVERNALE' | 'QUATTRO_STAGIONI';
      stato_affiliazione: 'IN_ATTESA' | 'ATTIVA' | 'SOSPESA';
      usura: 'REGOLARE' | 'INTERNA' | 'ESTERNA' | 'CENTRALE' | 'BORDI';
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
      origine_dato: ['APP', 'IMPORT'],
      posizione_pneumatico: ['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX', 'SCORTA'],
      ruolo: ['ADMIN', 'OFFICINA', 'CLIENTE'],
      ruolo_officina: ['TITOLARE', 'OPERATORE'],
      stagione: ['ESTIVO', 'INVERNALE', 'QUATTRO_STAGIONI'],
      stato_affiliazione: ['IN_ATTESA', 'ATTIVA', 'SOSPESA'],
      usura: ['REGOLARE', 'INTERNA', 'ESTERNA', 'CENTRALE', 'BORDI'],
    },
  },
} as const;
