import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* Lieber hier laut scheitern als später mit einer krummen Fehlermeldung
   irgendwo mitten in der App. */
if (!url || !key) {
  throw new Error(
    "VITE_SUPABASE_URL oder VITE_SUPABASE_ANON_KEY fehlt — siehe .env"
  );
}

export const supabase = createClient(url, key, {
  auth: {
    /* Anmeldung übersteht das Schließen der App. Ein Monteur soll sich
       nicht jeden Morgen auf dem Gerüst neu anmelden. */
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/* Die Rechteregeln in der Datenbank hängen an auth.uid(). Ohne Anmeldung
   liefert jede Abfrage leer zurück — das ist kein Fehler, sondern der
   Zweck der Übung. */
export const angemeldet = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
};
