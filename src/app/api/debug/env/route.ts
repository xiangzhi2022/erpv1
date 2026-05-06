import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.COZE_SUPABASE_URL || 'NOT SET',
    hasAnonKey: !!process.env.COZE_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.COZE_SUPABASE_SERVICE_ROLE_KEY,
  });
}
