import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://giipbcwdacebprtljeoo.supabase.co';
const supabaseKey = 'sb_publishable_NwwRS1exnQmhC6R5JlAn3A_ZF1-w6eP';

export const supabase = createClient(supabaseUrl, supabaseKey);
