// Minimal types for Edge Function (prescriptions / logs)
export interface Database {
  public: {
    Tables: {
      prescriptions: {
        Row: {
          id: string;
          status: string;
          issued_at: string;
          issued_date_str: string | null;
          patient_initials: string | null;
          prescriber_crm_uf: string | null;
          prescriber_crm_last4: string | null;
          verify_code_hash: string | null;
          qr_token_hash: string | null;
          qr_token_expires_at: string | null;
          pdf_storage_path: string | null;
        };
      };
      prescription_verification_logs: {
        Insert: {
          prescription_id: string;
          ip?: string | null;
          user_agent?: string | null;
          outcome: string;
          details?: Record<string, unknown> | null;
        };
      };
    };
  };
}
