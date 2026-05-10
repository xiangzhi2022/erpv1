import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json() as { phone?: string };

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号' },
        { status: 400 }
      );
    }

    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 验证码5分钟过期
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const supabase = getSupabaseClient();

    // 存储验证码
    const { error: insertError } = await supabase
      .from('sms_codes')
      .insert({
        phone,
        code,
        type: 'register',
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('存储验证码失败:', insertError.message);
      return NextResponse.json(
        { success: false, error: '验证码存储失败' },
        { status: 500 }
      );
    }

    // 检查是否配置了短信服务商
    const hasSMSConfig = process.env.SMS_PROVIDER &&
                         ((process.env.SMS_PROVIDER === 'ronglian' && process.env.RONGLIAN_ACCOUNT_SID) ||
                          (process.env.SMS_PROVIDER === 'huanyi' && process.env.HUANYI_API_ID));

    if (!hasSMSConfig) {
      // 仅开发模式下在控制台输出验证码
      if (process.env.COZE_PROJECT_ENV === 'DEV') {
        console.log(`[DEV] SMS verification code for ${phone}: ${code}`);
      }
      return NextResponse.json({
        success: true,
        message: '验证码已发送（开发模式，验证码见控制台）',
        // 仅在开发模式下返回验证码，生产环境绝不暴露
        ...(process.env.COZE_PROJECT_ENV === 'DEV' ? { dev_code: code } : {}),
      });
    }

    // 调用短信服务商API发送验证码
    let smsResult = false;

    if (process.env.SMS_PROVIDER === 'ronglian') {
      smsResult = await sendViaRongLian(phone, code);
    } else if (process.env.SMS_PROVIDER === 'huanyi') {
      smsResult = await sendViaHuanyi(phone, code);
    }

    if (!smsResult) {
      return NextResponse.json(
        { success: false, error: '短信发送失败，请稍后重试' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '验证码已发送',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error('发送验证码失败:', message);
    return NextResponse.json(
      { success: false, error: '发送失败，请稍后重试' },
      { status: 500 }
    );
  }
}

// 容联云发送函数
async function sendViaRongLian(phone: string, code: string): Promise<boolean> {
  try {
    const accountSid = process.env.RONGLIAN_ACCOUNT_SID;
    const accountToken = process.env.RONGLIAN_ACCOUNT_TOKEN;
    const appId = process.env.RONGLIAN_APP_ID;

    if (!accountSid || !accountToken || !appId) return false;

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const sig = crypto
      .createHash('md5')
      .update(accountSid + accountToken + timestamp)
      .digest('hex')
      .toUpperCase();

    const auth = Buffer.from(accountSid + ':' + timestamp).toString('base64');

    const response = await fetch(
      `https://app.cloopen.com:8883/2013-12-26/Accounts/${accountSid}/SMS/TemplateSMS?sig=${sig}`,
      {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phone,
          appId,
          templateId: '1',
          datas: [code, '5分钟'],
        }),
      }
    );

    const result = await response.json() as { statusCode?: string };
    return result.statusCode === '000000';
  } catch (error) {
    console.error('容联云发送失败:', error instanceof Error ? error.message : '未知错误');
    return false;
  }
}

// 互亿无线发送函数
async function sendViaHuanyi(phone: string, code: string): Promise<boolean> {
  try {
    const apiId = process.env.HUANYI_API_ID;
    const apiKey = process.env.HUANYI_API_KEY;

    if (!apiId || !apiKey) return false;

    const params = new URLSearchParams({
      account: apiId,
      password: apiKey,
      mobile: phone,
      content: `您的验证码是：${code}。请在5分钟内完成验证。`,
    });

    const response = await fetch('http://api.ihuyi.com/webservice/sms.php?method=Submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const result = await response.text();
    return result.includes('<code>2</code>');
  } catch (error) {
    console.error('互亿无线发送失败:', error instanceof Error ? error.message : '未知错误');
    return false;
  }
}
