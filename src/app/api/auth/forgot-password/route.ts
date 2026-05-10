import { NextRequest, NextResponse } from 'next/server';
import { generateResetToken, updateUserPassword, updateUserPasswordInDB } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json({ success: false, error: '请输入邮箱地址' }, { status: 400 });
    }

    // 邮箱格式校验
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: '邮箱格式不正确' }, { status: 400 });
    }

    // 生成重置令牌（无论邮箱是否存在，都返回相同响应，避免用户枚举）
    const token = generateResetToken(email);

    // 构建重置链接
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    const resetUrl = `${domain}/reset-password?token=${token}`;

    // ===== 邮件发送逻辑 =====
    // 生产环境应接入邮件服务（SMTP / SendGrid / Resend 等）
    // 当前为开发模式：将重置链接输出到控制台，方便调试
    if (process.env.COZE_PROJECT_ENV === 'DEV') {
      console.log(`[DEV] Password reset link: ${resetUrl}`);
      console.log(`[DEV] Recipient: ${email}`);
    }

    // 检查是否配置了邮件服务
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      // 如果配置了 SMTP，发送真实邮件
      // nodemailer 为可选依赖，需手动安装: pnpm add nodemailer && pnpm add -D @types/nodemailer
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: `"${process.env.SMTP_FROM_NAME || '系统通知'}" <${smtpUser}>`,
          to: email,
          subject: '密码重置 - 重置您的密码',
          html: `
            <div style="max-width:600px;margin:0 auto;padding:20px;font-family:sans-serif;">
              <h2 style="color:#1a1a1a;">密码重置</h2>
              <p style="color:#666;">您好，</p>
              <p style="color:#666;">我们收到了您的密码重置请求。请点击下方按钮重置密码：</p>
              <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0;">重置密码</a>
              <p style="color:#999;font-size:12px;">此链接 30 分钟内有效。如果按钮无法点击，请复制以下链接到浏览器：</p>
              <p style="color:#666;font-size:12px;word-break:break-all;">${resetUrl}</p>
              <p style="color:#999;font-size:12px;">如果您没有发起此请求，请忽略此邮件。</p>
            </div>
          `,
        });

        return NextResponse.json({ success: true, message: '重置邮件已发送，请查收' });
      } catch (mailErr) {
        console.error('邮件发送失败:', mailErr instanceof Error ? mailErr.message : '未知错误');
        return NextResponse.json({ success: false, error: '邮件发送失败，请稍后重试' }, { status: 500 });
      }
    }

    // 开发模式：返回提示（包含重置链接用于测试）
    return NextResponse.json({
      success: true,
      message: '如果该邮箱已注册，重置链接已发送',
      // 仅开发模式下返回重置链接
      ...(process.env.COZE_PROJECT_ENV === 'DEV' ? { devResetUrl: resetUrl } : {}),
    });
  } catch {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
