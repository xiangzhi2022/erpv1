import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface SettingItem {
  user_id: string;
  setting_value: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix');
    const userId = searchParams.get('userId');

    if (!prefix) {
      return NextResponse.json(
        { success: false, error: '请提供要验证的前缀' },
        { status: 400 }
      );
    }

    // 获取Supabase客户端
    const supabase = getSupabaseClient();

    // 检查前缀是否已被其他用户使用
    const { data, error } = await supabase
      .from('user_settings')
      .select('user_id, setting_value')
      .eq('setting_key', 'order_prefix')
      .eq('setting_value', prefix);

    if (error) {
      console.error('查询前缀失败:', error);
      return NextResponse.json(
        { success: false, error: '验证失败' },
        { status: 500 }
      );
    }

    // 如果找到了记录，检查是否是当前用户
    if (data && data.length > 0) {
      // 如果指定了userId，排除当前用户
      if (userId && (data as SettingItem[]).some((item: SettingItem) => item.user_id === userId)) {
        return NextResponse.json({
          success: true,
          available: true,
          message: '该前缀已被您使用'
        });
      }
      
      return NextResponse.json({
        success: true,
        available: false,
        message: '该前缀已被其他用户使用'
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
      message: '该前缀可用'
    });
  } catch (error) {
    console.error('验证前缀出错:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
