import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';
import { isUserAdmin } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    
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
    // 规则：超级管理员、生产商租户用户、订单管理角色 都视为管理员
    const isAdmin = isUserAdmin(user);
    
    // 非管理员只能查看自己的前缀配置
    if (!isAdmin) {
      // 从user_settings表获取用户自己的设置
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
        isAdmin: isAdmin
      });
    }
    
    // 超级管理员从order_prefixes表获取所有前缀配置
    const { data, error } = await supabase
      .from('order_prefixes')
      .select('prefix')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('获取前缀配置失败:', error);
      return NextResponse.json(
        { success: false, error: '获取配置失败' },
        { status: 500 }
      );
    }
    
    // 同时获取用户自己的user_settings
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
    
    // 如果没有用户自己的前缀设置，尝试加载order_prefixes中的第一个
    if (!settings.order_prefix && data && data.length > 0) {
      settings.order_prefix = data[0].prefix;
    }
    
    return NextResponse.json({ 
      success: true, 
      settings,
      prefixes: data || [],
      isAdmin: true
    });
    
  } catch (error) {
    console.error('获取设置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取设置失败' },
      { status: 500 }
    );
  }
}
