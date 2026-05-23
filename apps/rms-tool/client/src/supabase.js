import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn(
    "[rms-tool] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Auth and DB calls will fail until you populate apps/rms-tool/.env.",
  );
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anon || "placeholder");
