import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { isUserAdmin } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // 获取当前用户
    const userCookie = request.cookies.get('erp_user');
    if (!userCookie) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const user = JSON.parse(userCookie.value);

    // 使用统一的权限检查函数
    const isAdmin = isUserAdmin(user);

    // 非管理员只能查看自己的设置
    if (!isAdmin) {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_key, setting_value')
        .eq('user_id', user.id);

      if (error) {
        console.error('获取设置失败:', error);
        return NextResponse.json(
          { success: false, error: '获取设置失败' },
          { status: 500 }
        );
      }

      const settings: Record<string, string> = {};
      if (data) {
        data.forEach((item: { setting_key: string; setting_value: string }) => {
          settings[item.setting_key] = item.setting_value;
        });
      }

      return NextResponse.json({
        success: true,
        settings,
        isAdmin: isAdmin,
      });
    }

    // 管理员从 order_prefixes 表获取所有前缀配置
    const { data: prefixData, error: prefixError } = await supabase
      .from('order_prefixes')
      .select('prefix, company_name, phone, address')
      .order('created_at', { ascending: false });

    if (prefixError) {
      console.error('获取前缀配置失败:', prefixError);
      return NextResponse.json(
        { success: false, error: '获取配置失败' },
        { status: 500 }
      );
    }

    // 同时获取用户自己的 user_settings
    const { data: userSettings, error: userSettingsError } = await supabase
      .from('user_settings')
      .select('setting_key, setting_value')
      .eq('user_id', user.id);

    if (userSettingsError) {
      console.error('获取用户设置失败:', userSettingsError);
    }

    const settings: Record<string, string> = {};
    if (userSettings) {
      userSettings.forEach((item: { setting_key: string; setting_value: string }) => {
        settings[item.setting_key] = item.setting_value;
      });
    }

    // 如果没有用户自己的前缀设置，尝试加载 order_prefixes 中的第一个
    if (!settings.order_prefix && prefixData && prefixData.length > 0) {
      settings.order_prefix = prefixData[0].prefix;
    }

    // 如果没有用户的公司名设置，尝试加载 order_prefixes 中的第一个
    if (!settings.company_name && prefixData && prefixData.length > 0) {
      settings.company_name = prefixData[0].company_name || '';
    }

    return NextResponse.json({
      success: true,
      settings,
      prefixes: prefixData || [],
      isAdmin: true,
    });
  } catch (error) {
    console.error('获取设置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取设置失败' },
      { status: 500 }
    );
  }
}
