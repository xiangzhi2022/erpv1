import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('id, phone, nickname, role, password')
      .eq('phone', '13506872751')
      .single();
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: 'Query failed'
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      user: data,
      message: 'Found user'
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
}
