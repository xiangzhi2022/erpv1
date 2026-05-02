import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('erp_user');
    
    if (!userCookie?.value) {
      return NextResponse.json({ available: true, message: '验证跳过' });
    }
    
    const { prefix } = await request.json();
    
    if (!prefix || prefix.length < 2) {
      return NextResponse.json({ available: false, error: '前缀至少2个字符' });
    }
    
    const upperPrefix = prefix.toUpperCase();
    
    // 使用 Supabase REST API 直接查询
    const url = process.env.COZE_SUPABASE_URL;
    const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !serviceKey) {
      return NextResponse.json({ available: true, message: '验证跳过' });
    }
    
    const apiUrl = `${url}/rest/v1/user_settings?setting_key=eq.order_prefix&setting_value=eq.${upperPrefix}&select=id`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    
    if (!response.ok) {
      return NextResponse.json({ available: true, message: '验证跳过' });
    }
    
    const data = await response.json();
    
    // 如果找到记录，说明前缀已被使用
    if (Array.isArray(data) && data.length > 0) {
      return NextResponse.json({ 
        available: false, 
        error: '该前缀已被使用' 
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
