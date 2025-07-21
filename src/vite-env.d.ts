/// <reference types="vite/client" />

// Supabase Environment Variables
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Legacy EZSite API declarations (for backward compatibility during migration)
declare global {
  interface Window {
    ezsite?: {
      apis: {
        tablePage: (tableId: string | number, options: any) => Promise<{ data: any; error?: any }>;
        tableCreate: (tableId: string | number, data: any) => Promise<{ error?: any }>;
        tableUpdate: (tableId: string | number, data: any) => Promise<{ error?: any }>;
        tableDelete: (tableId: string | number, data: any) => Promise<{ error?: any }>;
      };
    };
  }
}