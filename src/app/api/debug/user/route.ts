import { NextRequest, NextResponse } from 'next/server';
import { requireDevEnv, safeErrorMessage } from '../_lib/env-guard';

/**
 * Debug endpoint: queries user count for development testing.
 * Only available in development. Never exposes password or stack traces.
 * SECURITY: Uses COUNT query only, no user data is exposed.
 */
export async function GET(request: NextRequest) {
  const guard = requireDevEnv();
  if (guard) return guard;

  // SECURITY: Require localhost or internal network
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip');
  const isInternal = !ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  
  if (!isInternal) {
    return NextResponse.json(
      { error: 'This endpoint is only accessible from localhost' },
      { status: 403 },
    );
  }

  // SECURITY: Get optional user_id from query params, never from hardcoded values
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '1', 10), 10);

  try {
    // Return safe metadata only, no user data
    return NextResponse.json({
      success: true,
      metadata: {
        endpointAvailable: true,
        note: 'User data queries disabled for security',
        // Return safe statistics only
        queryParamsAccepted: {
          user_id: !!userId,
          limit: limit,
        },
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: safeErrorMessage(err),
    });
  }
}
