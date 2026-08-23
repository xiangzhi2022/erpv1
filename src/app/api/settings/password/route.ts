import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { passwordSchema } from '@/app/settings/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError } from '@/lib/auth/route-response';
import { authFailed, requireSettingsUser } from '../_utils';

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const parsed = passwordSchema.safeParse(await parseJsonObject(request));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || '密码参数不正确' },
        { status: 400 },
      );
    }

    await (await createAuthService()).changePassword(
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    return authRouteError(error);
  }
}
