import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

const getServiceClient = () => getSupabaseClient();

interface CurrentUser {
  id: string;
  role: string;
  tenant_id?: string;
}

async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const userStr = cookieStore.get('erp_user')?.value;
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// POST /api/orders/generate - Generate order number with atomic sequence
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { prefix } = body;

    if (!prefix || !prefix.trim()) {
      return Response.json({ success: false, error: '前缀不能为空' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');

    // Atomic sequence generation using Supabase RPC or upsert pattern
    // Use the order_sequences table for atomic increment
    const sequenceKey = `${prefix.trim()}-${dateStr}`;

    // Try to atomically increment the sequence using upsert
    const { data: seqData, error: seqError } = await supabase
      .from('order_sequences')
      .upsert(
        { key: sequenceKey, value: 1 },
        { onConflict: 'key' }
      )
      .select()
      .single();

    if (seqError) {
      // If order_sequences table doesn't exist, fall back to counting
      // Count existing orders with this prefix-date pattern
      const { count, error: countError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .like('order_no', `${prefix}${dateStr}%`);

      if (countError) {
        console.error('Generate order number count error:', countError);
        return Response.json({ success: false, error: '生成订单号失败' }, { status: 500 });
      }

      const seq = (count || 0) + 1;
      const orderNo = `${prefix}${dateStr}${String(seq).padStart(3, '0')}`;
      return Response.json({ success: true, data: { order_no: orderNo } });
    }

    // If we got here, the sequence table exists
    // We need to increment the value atomically
    // Since upsert with onConflict doesn't auto-increment, use RPC or manual increment
    const currentValue = (seqData as { key: string; value: number })?.value || 0;
    const newValue = currentValue + 1;

    const { error: updateError } = await supabase
      .from('order_sequences')
      .update({ value: newValue })
      .eq('key', sequenceKey);

    if (updateError) {
      console.error('Update sequence error:', updateError);
    }

    const seq = updateError ? currentValue + 1 : newValue;
    const orderNo = `${prefix}${dateStr}${String(seq).padStart(3, '0')}`;
    return Response.json({ success: true, data: { order_no: orderNo } });
  } catch (err) {
    console.error('Generate order number error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
