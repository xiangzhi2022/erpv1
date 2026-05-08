import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';

export async function POST(request: NextRequest) {
  try {
    const { prefix } = await request.json();
    
    if (!prefix || prefix.length < 2) {
      return NextResponse.json({ available: false, error: '前缀至少2个字符' });
    }
    
    const upperPrefix = prefix.toUpperCase();
    const supabase = getSupabaseClient();
    
    // 从新的order_prefixes表查询
    const { data, error } = await supabase
      .from('order_prefixes')
      .select('prefix, company_name')
      .eq('prefix', upperPrefix)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('验证前缀失败:', error);
      return NextResponse.json({ available: true, message: '验证跳过' });
    }
    
    if (data) {
      return NextResponse.json({ 
        available: false, 
        error: `该前缀已被"${data.company_name}"使用` 
      });
    }
    
    return NextResponse.json({ 
      available: true, 
      message: '该前缀可用' 
    });
  } catch (error) {
    console.error('验证前缀失败:', error);
    return NextResponse.json({ available: true, message: '验证跳过' });
  }
}
