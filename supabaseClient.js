import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://leuyfasvbfwdaloapmrs.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldXlmYXN2YmZ3ZGFsb2FwbXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExMTczMzUsImV4cCI6MjA1NjY5MzMzNX0.Y_s-KMy9n_Ht2OVaxmQEjnDRniqJ_DcppQVam7uAGk4";

export const supabase = createClient(supabaseUrl, supabaseKey);
