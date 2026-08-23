#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config as loadEnvironment } from 'dotenv';

loadEnvironment({ path: ['.env.local', '.env'], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !secretKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for the read-only legacy report.',
  );
}

const supabase = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const { data, error } = await supabase
  .from('users')
  .select('id,email,phone,is_active');

if (error) {
  const missingLegacyTable = error.code === '42P01' || error.code === 'PGRST205';
  if (missingLegacyTable) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceAvailable: false,
      total: 0,
      message: 'The legacy public.users table is not present in this environment.',
    }, null, 2));
    process.exit(0);
  }
  throw new Error(`Legacy identity report failed (${error.code || 'unknown'}).`);
}

const rows = data || [];
const contactCounts = new Map();
let emailEligible = 0;
let phoneEligible = 0;
let missingContact = 0;
let inactive = 0;

for (const row of rows) {
  const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
  const phone = typeof row.phone === 'string' ? row.phone.replace(/\D/g, '') : '';
  if (email) emailEligible += 1;
  else if (/^1[3-9]\d{9}$/.test(phone)) phoneEligible += 1;
  else missingContact += 1;
  if (row.is_active === false) inactive += 1;

  const contact = email ? `email:${email}` : phone ? `phone:${phone}` : '';
  if (contact) contactCounts.set(contact, (contactCounts.get(contact) || 0) + 1);
}

const duplicateContacts = Array.from(contactCounts.values())
  .filter((count) => count > 1)
  .reduce((total, count) => total + count, 0);

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceAvailable: true,
  total: rows.length,
  emailEligible,
  phoneEligible,
  missingContact,
  inactive,
  duplicateContacts,
  containsPersonalData: false,
}, null, 2));
