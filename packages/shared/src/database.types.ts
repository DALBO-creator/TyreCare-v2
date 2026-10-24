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
      chiusure_officina: {
        Row: {
          al: string;
          created_at: string;
          dal: string;
          id: string;
          motivo: string;
          officina_id: string;
        };
        Insert: {
          al: string;
          created_at?: string;
          dal: string;
          id?: string;
          motivo?: string;
          officina_id: string;
        };
        Update: {
          al?: string;
          created_at?: string;
          dal?: string;
          id?: string;
          motivo?: string;
          officina_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chiusure_officina_officina_id_fkey';
            columns: ['officina_id'];
            isOneToOne: false;
            referencedRelation: 'officine';
            referencedColumns: ['id'];
          },
        ];
      };
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
      commenti: {
        Row: {
          autore_id: string;
          created_at: string;
          id: string;
          officina_id: string | null;
          percorso: string;
          testo: string;
        };
        Insert: {
          autore_id?: string;
          created_at?: string;
          id: string;
          officina_id?: string | null;
          percorso?: string;
          testo: string;
        };
        Update: {
          autore_id?: string;
          created_at?: string;
          id?: string;
          officina_id?: string | null;
          percorso?: string;
          testo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'commenti_autore_id_fkey';
            columns: ['autore_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commenti_officina_id_fkey';
            columns: ['officina_id'];
            isOneToOne: false;
            referencedRelation: 'officine';
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
      import_log: {
        Row: {
          clienti_aggiornati: number;
          clienti_nuovi: number;
          created_at: string;
          eseguito_da: string | null;
          id: string;
          nome_file: string;
          officina_id: string;
          righe_importate: number;
          righe_scartate: number;
          tipo: string;
          veicoli_aggiornati: number;
          veicoli_nuovi: number;
        };
        Insert: {
          clienti_aggiornati?: number;
          clienti_nuovi?: number;
          created_at?: string;
          eseguito_da?: string | null;
          id?: string;
          nome_file?: string;
          officina_id: string;
          righe_importate: number;
          righe_scartate?: number;
          tipo?: string;
          veicoli_aggiornati?: number;
          veicoli_nuovi?: number;
        };
        Update: {
          clienti_aggiornati?: number;
          clienti_nuovi?: number;
          created_at?: string;
          eseguito_da?: string | null;
          id?: string;
          nome_file?: string;
          officina_id?: string;
          righe_importate?: number;
          righe_scartate?: number;
          tipo?: string;
          veicoli_aggiornati?: number;
          veicoli_nuovi?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'import_log_eseguito_da_fkey';
            columns: ['eseguito_da'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'import_log_officina_id_fkey';
            columns: ['officina_id'];
            isOneToOne: false;
            referencedRelation: 'officine';
            referencedColumns: ['id'];
          },
        ];
      };
      import_mappature: {
        Row: {
          colonne: NonNullable<Json>;
          creata_da: string | null;
          created_at: string;
          id: string;
          nome: string;
          officina_id: string;
          updated_at: string;
        };
        Insert: {
          colonne: NonNullable<Json>;
          creata_da?: string | null;
          created_at?: string;
          id?: string;
          nome: string;
          officina_id: string;
          updated_at?: string;
        };
        Update: {
          colonne?: NonNullable<Json>;
          creata_da?: string | null;
          created_at?: string;
          id?: string;
          nome?: string;
          officina_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'import_mappature_creata_da_fkey';
            columns: ['creata_da'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'import_mappature_officina_id_fkey';
            columns: ['officina_id'];
            isOneToOne: false;
            referencedRelation: 'officine';
            referencedColumns: ['id'];
          },
        ];
      };
      inviti_cliente: {
        Row: {
          annullato_il: string | null;
          cliente_officina_id: string;
          codice_hash: string;
          created_at: string;
          creato_da: string | null;
          email: string;
          id: string;
          officina_id: string;
          scade_il: string;
          usato_da: string | null;
          usato_il: string | null;
        };
        Insert: {
          annullato_il?: string | null;
          cliente_officina_id: string;
          codice_hash: string;
          created_at?: string;
          creato_da?: string | null;
          email: string;
          id?: string;
          officina_id: string;
          scade_il: string;
          usato_da?: string | null;
          usato_il?: string | null;
        };
        Update: {
          annullato_il?: string | null;
          cliente_officina_id?: string;
          codice_hash?: string;
          created_at?: string;
          creato_da?: string | null;
          email?: string;
          id?: string;
          officina_id?: string;
          scade_il?: string;
          usato_da?: string | null;
          usato_il?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'inviti_cliente_cliente_officina_id_officina_id_fkey';
            columns: ['cliente_officina_id', 'officina_id'];
            isOneToOne: false;
            referencedRelation: 'clienti_officina';
            referencedColumns: ['id', 'officina_id'];
          },
          {
            foreignKeyName: 'inviti_cliente_creato_da_fkey';
            columns: ['creato_da'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inviti_cliente_usato_da_fkey';
            columns: ['usato_da'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      iscrizioni_push: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          profile_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          profile_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'iscrizioni_push_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
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
      notifiche: {
        Row: {
          chiave: string | null;
          created_at: string;
          destinatario_id: string;
          id: string;
          letta_il: string | null;
          link: string;
          prenotazione_id: string | null;
          testo: string;
          tipo: Database['public']['Enums']['tipo_notifica'];
          titolo: string;
        };
        Insert: {
          chiave?: string | null;
          created_at?: string;
          destinatario_id: string;
          id?: string;
          letta_il?: string | null;
          link: string;
          prenotazione_id?: string | null;
          testo?: string;
          tipo: Database['public']['Enums']['tipo_notifica'];
          titolo: string;
        };
        Update: {
          chiave?: string | null;
          created_at?: string;
          destinatario_id?: string;
          id?: string;
          letta_il?: string | null;
          link?: string;
          prenotazione_id?: string | null;
          testo?: string;
          tipo?: Database['public']['Enums']['tipo_notifica'];
          titolo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifiche_destinatario_id_fkey';
            columns: ['destinatario_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifiche_prenotazione_id_fkey';
            columns: ['prenotazione_id'];
            isOneToOne: false;
            referencedRelation: 'prenotazioni';
            referencedColumns: ['id'];
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
          capienza_fascia: number | null;
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
          capienza_fascia?: number | null;
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
          capienza_fascia?: number | null;
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
      prenotazioni: {
        Row: {
          appuntamento: string | null;
          cliente_id: string;
          created_at: string;
          fascia: Database['public']['Enums']['fascia_oraria'];
          gestita_da: string | null;
          giorno: string;
          id: string;
          messaggio_officina: string;
          nome_cliente: string;
          note: string;
          officina_id: string;
          promemoria_per: string | null;
          servizio: string;
          servizio_id: string | null;
          stato: Database['public']['Enums']['stato_prenotazione'];
          targa: string;
          telefono_cliente: string;
          updated_at: string;
          veicolo: string;
        };
        Insert: {
          appuntamento?: string | null;
          cliente_id: string;
          created_at?: string;
          fascia: Database['public']['Enums']['fascia_oraria'];
          gestita_da?: string | null;
          giorno: string;
          id?: string;
          messaggio_officina?: string;
          nome_cliente: string;
          note?: string;
          officina_id: string;
          promemoria_per?: string | null;
          servizio: string;
          servizio_id?: string | null;
          stato?: Database['public']['Enums']['stato_prenotazione'];
          targa: string;
          telefono_cliente: string;
          updated_at?: string;
          veicolo?: string;
        };
        Update: {
          appuntamento?: string | null;
          cliente_id?: string;
          created_at?: string;
          fascia?: Database['public']['Enums']['fascia_oraria'];
          gestita_da?: string | null;
          giorno?: string;
          id?: string;
          messaggio_officina?: string;
          nome_cliente?: string;
          note?: string;
          officina_id?: string;
          promemoria_per?: string | null;
          servizio?: string;
          servizio_id?: string | null;
          stato?: Database['public']['Enums']['stato_prenotazione'];
          targa?: string;
          telefono_cliente?: string;
          updated_at?: string;
          veicolo?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prenotazioni_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prenotazioni_gestita_da_fkey';
            columns: ['gestita_da'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prenotazioni_officina_id_fkey';
            columns: ['officina_id'];
            isOneToOne: false;
            referencedRelation: 'officine';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prenotazioni_servizio_id_officina_id_fkey';
            columns: ['servizio_id', 'officina_id'];
            isOneToOne: false;
            referencedRelation: 'servizi_officina';
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
      servizi_officina: {
        Row: {
          created_at: string;
          descrizione: string;
          durata_minuti: number | null;
          id: string;
          nome: string;
          officina_id: string;
          prenotabile: boolean;
          prezzo_da: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          descrizione?: string;
          durata_minuti?: number | null;
          id?: string;
          nome: string;
          officina_id: string;
          prenotabile?: boolean;
          prezzo_da?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          descrizione?: string;
          durata_minuti?: number | null;
          id?: string;
          nome?: string;
          officina_id?: string;
          prenotabile?: boolean;
          prezzo_da?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'servizi_officina_officina_id_fkey';
            columns: ['officina_id'];
            isOneToOne: false;
            referencedRelation: 'officine';
            referencedColumns: ['id'];
          },
        ];
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
      accetta_invito: { Args: { p_codice: string }; Returns: string };
      annulla_invito_cliente: { Args: { p_cliente_id: string }; Returns: undefined };
      annulla_prenotazione: { Args: { p_id: string }; Returns: undefined };
      crea_invito_cliente: {
        Args: { p_cliente_id: string; p_email: string };
        Returns: {
          codice: string;
          scade_il: string;
        }[];
      };
      crea_officina_con_titolare: {
        Args: { p_email_titolare: string; p_partita_iva: string; p_ragione_sociale: string };
        Returns: string;
      };
      crea_promemoria_appuntamenti: { Args: { p_adesso?: string }; Returns: number };
      crea_promemoria_pneumatici: { Args: { p_adesso?: string }; Returns: number };
      elimina_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      fasce_aperte: {
        Args: { p_giorno: string; p_orari: Json };
        Returns: Database['public']['Enums']['fascia_oraria'][];
      };
      fasce_piene: {
        Args: { p_officina_id: string };
        Returns: {
          fascia: Database['public']['Enums']['fascia_oraria'];
          giorno: string;
        }[];
      };
      giorni_prenotabili: { Args: Record<PropertyKey, never>; Returns: number };
      importa_clienti_veicoli: {
        Args: {
          p_nome_file?: string;
          p_officina_id: string;
          p_righe: Json;
          p_righe_scartate?: number;
          p_simula?: boolean;
        };
        Returns: Json;
      };
      impronta_codice: { Args: { p_codice: string }; Returns: string };
      info_invito: {
        Args: { p_codice: string };
        Returns: {
          email: string;
          officina: string;
          scade_il: string;
          stato: string;
          usato_da_te: boolean;
        }[];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_cliente_officina: { Args: { p_officina_id: string }; Returns: boolean };
      is_collega: { Args: { p_profile_id: string }; Returns: boolean };
      is_membro_officina: { Args: { p_officina_id: string }; Returns: boolean };
      is_titolare_officina: { Args: { p_officina_id: string }; Returns: boolean };
      is_veicolo_mio: { Args: { p_veicolo_id: string }; Returns: boolean };
      iscrivi_push: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string };
        Returns: undefined;
      };
      mappatura_import_valida: { Args: { p_colonne: Json }; Returns: boolean };
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
      occupazione_fascia: {
        Args: {
          p_fascia: Database['public']['Enums']['fascia_oraria'];
          p_giorno: string;
          p_officina_id: string;
        };
        Returns: number;
      };
      oggi_in_italia: { Args: Record<PropertyKey, never>; Returns: string };
      orari_validi: { Args: { p_orari: Json }; Returns: boolean };
      registra_cliente_da_prenotazione: {
        Args: {
          p_cliente_id: string;
          p_marca: string;
          p_modello: string;
          p_prenotazione: string;
          p_veicolo_id: string;
        };
        Returns: string;
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
      richiedi_prenotazione: {
        Args: {
          p_fascia: Database['public']['Enums']['fascia_oraria'];
          p_giorno: string;
          p_id?: string;
          p_note?: string;
          p_officina_id: string;
          p_servizio_id: string;
          p_targa: string;
          p_telefono: string;
          p_veicolo: string;
        };
        Returns: string;
      };
      rispondi_prenotazione: {
        Args: { p_appuntamento?: string; p_azione: string; p_id: string; p_messaggio?: string };
        Returns: undefined;
      };
      rispondi_proposta: { Args: { p_accetta: boolean; p_id: string }; Returns: undefined };
      stato_battistrada: {
        Args: { p_mm: number; p_stagione: Database['public']['Enums']['stagione'] };
        Returns: string;
      };
      testo_gomme: { Args: { p_quante: number }; Returns: string };
      testo_quando: {
        Args: {
          p_appuntamento: string;
          p_fascia: Database['public']['Enums']['fascia_oraria'];
          p_giorno: string;
        };
        Returns: string;
      };
      testo_veicolo: {
        Args: { p_marca: string; p_modello: string; p_targa: string };
        Returns: string;
      };
      unisci_clienti: { Args: { p_da: string; p_in: string }; Returns: undefined };
    };
    Enums: {
      fascia_oraria: 'MATTINA' | 'POMERIGGIO';
      origine_dato: 'APP' | 'IMPORT';
      posizione_pneumatico: 'ANT_SX' | 'ANT_DX' | 'POST_SX' | 'POST_DX' | 'SCORTA';
      ruolo: 'ADMIN' | 'OFFICINA' | 'CLIENTE';
      ruolo_officina: 'TITOLARE' | 'OPERATORE';
      stagione: 'ESTIVO' | 'INVERNALE' | 'QUATTRO_STAGIONI';
      stato_affiliazione: 'IN_ATTESA' | 'ATTIVA' | 'SOSPESA';
      stato_prenotazione:
        | 'RICHIESTA'
        | 'PROPOSTA'
        | 'CONFERMATA'
        | 'RIFIUTATA'
        | 'ANNULLATA'
        | 'COMPLETATA'
        | 'NON_PRESENTATO';
      tipo_notifica:
        | 'NUOVA_RICHIESTA'
        | 'CONFERMATA'
        | 'PROPOSTA'
        | 'RIFIUTATA'
        | 'PROPOSTA_ACCETTATA'
        | 'ANNULLATA'
        | 'PROMEMORIA'
        | 'ESITO_CONTROLLO'
        | 'CAMBIO_STAGIONE';
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
      fascia_oraria: ['MATTINA', 'POMERIGGIO'],
      origine_dato: ['APP', 'IMPORT'],
      posizione_pneumatico: ['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX', 'SCORTA'],
      ruolo: ['ADMIN', 'OFFICINA', 'CLIENTE'],
      ruolo_officina: ['TITOLARE', 'OPERATORE'],
      stagione: ['ESTIVO', 'INVERNALE', 'QUATTRO_STAGIONI'],
      stato_affiliazione: ['IN_ATTESA', 'ATTIVA', 'SOSPESA'],
      stato_prenotazione: [
        'RICHIESTA',
        'PROPOSTA',
        'CONFERMATA',
        'RIFIUTATA',
        'ANNULLATA',
        'COMPLETATA',
        'NON_PRESENTATO',
      ],
      tipo_notifica: [
        'NUOVA_RICHIESTA',
        'CONFERMATA',
        'PROPOSTA',
        'RIFIUTATA',
        'PROPOSTA_ACCETTATA',
        'ANNULLATA',
        'PROMEMORIA',
        'ESITO_CONTROLLO',
        'CAMBIO_STAGIONE',
      ],
      usura: ['REGOLARE', 'INTERNA', 'ESTERNA', 'CENTRALE', 'BORDI'],
    },
  },
} as const;
