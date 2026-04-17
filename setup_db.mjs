import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cszizbtqgjhsoyybemhu.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzeml6YnRxZ2poc295eWJlbWh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAzMDY2MywiZXhwIjoyMDg3NjA2NjYzfQ.Qymzo0JZajT8r08b-Da1IGX2eg8--i88kCvqT5Ct4L4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setup() {
  console.log('--- Iniciando configuración de Supabase ---');

  // 1. Crear Usuario
  console.log('1. Creando usuario neomaffofficial@gmail.com...');
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: 'neomaffofficial@gmail.com',
    password: 'prueba1',
    email_confirm: true
  });

  if (userError) {
    if (userError.message.includes('already exists')) {
      console.log('✅ El usuario ya existe.');
    } else {
      console.error('❌ Error creando usuario:', userError.message);
    }
  } else {
    console.log('✅ Usuario creado exitosamente:', user.user.id);
  }

  // 2. Verificar Bucket de Storage
  console.log('2. Verificando Storage Bucket...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error('❌ Error listando buckets:', bucketError.message);
  } else {
    const bucketExists = buckets.find(b => b.name === 'project-assets');
    if (bucketExists) {
      console.log('✅ Bucket "project-assets" existe y está configurado.');
    } else {
      console.log('⚠️ Bucket no encontrado. Creándolo...');
      const { error: createBucketError } = await supabase.storage.createBucket('project-assets', {
        public: true
      });
      if (createBucketError) console.error('❌ Error creando bucket:', createBucketError.message);
      else console.log('✅ Bucket "project-assets" creado.');
    }
  }

  console.log('--- Configuración completada ---');
}

setup();
