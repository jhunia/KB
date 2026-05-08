/* ============================================
   Supabase Client Configuration
   ============================================ */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bnpbsgahppzehnrtvbei.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucGJzZ2FocHB6ZWhucnR2YmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTA2ODUsImV4cCI6MjA5MzI4NjY4NX0.SdbgBH-oAv3f75pF3UE884miEh1GTBRE_YUmSDhZv4Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
