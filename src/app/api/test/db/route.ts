import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', 'admin');
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: error 
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      data,
      count: data?.length || 0
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}
