import { createClient } from "@supabase/supabase-js";
import { env } from "@/app/(core)/config/env";

export const supabaseStorageClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
