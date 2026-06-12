const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const normalizeEnvValue = (value) => {
  if (!value) return value;

  return value.trim().replace(/^(['"])(.*)\1$/, '$2');
};

const supabaseUrl = normalizeEnvValue(process.env.SUPABASE_URL);
const supabaseKey = normalizeEnvValue(process.env.SUPABASE_KEY);

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'EXISTE' : 'NO EXISTE');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: WebSocket,
  },
});

module.exports = supabase;
