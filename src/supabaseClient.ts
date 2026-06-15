import { createClient } from "@supabase/supabase-js";
import { appConfig } from "./config";

export const hasSupabaseConfig = Boolean(appConfig.publicEnv.supabaseUrl && appConfig.publicEnv.supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(appConfig.publicEnv.supabaseUrl, appConfig.publicEnv.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

