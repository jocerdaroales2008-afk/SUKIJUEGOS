import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey) {
    throw new Error(
      'Faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
        'Crea un archivo .env en la raíz del proyecto (ver .env.example) con tus credenciales de Supabase.'
    );
  }

  client = createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}