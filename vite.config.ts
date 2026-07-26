import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '');
    const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(supabaseUrl)) {
      throw new Error(
        'Build interrotta: configura VITE_SUPABASE_URL con un URL pubblico Supabase valido.',
      );
    }
    if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-key') {
      throw new Error(
        "Build interrotta: configura VITE_SUPABASE_ANON_KEY nelle variabili dell'ambiente di deployment.",
      );
    }
  }

  return {
    plugins: [react()],
  };
});
