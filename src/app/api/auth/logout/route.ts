import { NextResponse } from 'next/server';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError } from '@/lib/auth/route-response';

export async function POST(): Promise<NextResponse> {
  try {
    await (await createAuthService()).signOut();
    return NextResponse.json({ success: true });
  } catch (error) {
    return authRouteError(error);
  }
}
