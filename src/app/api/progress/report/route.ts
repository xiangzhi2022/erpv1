import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { progressReportSchema } from '@/app/progress/schemas';

// Submit progress report
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = progressReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: '参数校验失败', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { work_order_id, action, completed_delta, remark } = parsed.data;
    const supabase = getSupabaseClient();

    // Get current work order
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('id, status, completed_quantity, target_quantity')
      .eq('id', work_order_id)
      .single();

    if (woError) {
      throw new Error(`查询工单失败: ${woError.message}`);
    }

    if (!workOrder) {
      return NextResponse.json({ success: false, error: '工单不存在' }, { status: 404 });
    }

    // Validate completed quantity won't exceed target
    const newCompletedQuantity = workOrder.completed_quantity + (completed_delta || 0);
    if (newCompletedQuantity > workOrder.target_quantity) {
      return NextResponse.json(
        { success: false, error: `完成数量(${newCompletedQuantity})不能超过目标数量(${workOrder.target_quantity})` },
        { status: 400 }
      );
    }

    // Determine new status based on action
    let newStatus = workOrder.status;
    switch (action) {
      case 'start':
        newStatus = 'producing';
        break;
      case 'complete_cutting':
      case 'complete_assembly':
      case 'complete_painting':
        newStatus = 'producing';
        break;
      case 'quality_check':
        newStatus = 'inspecting';
        break;
      case 'warehouse_in':
        newStatus = 'stored';
        break;
      case 'pause':
        newStatus = 'pending';
        break;
      case 'abort':
        newStatus = 'aborted';
        break;
      case 'report_progress':
        // Keep current status
        break;
      case 'report_defect':
        // Keep current status but log the defect
        break;
      case 'resume':
        newStatus = 'producing';
        break;
    }

    // Auto-complete if target reached
    if (newCompletedQuantity >= workOrder.target_quantity && action !== 'abort') {
      newStatus = 'inspecting';
    }

    // Update work order
    const updateData: Record<string, unknown> = {
      status: newStatus,
      completed_quantity: newCompletedQuantity,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'producing' && workOrder.status !== 'producing') {
      updateData.start_date = new Date().toISOString();
    }
    if (newStatus === 'stored') {
      updateData.actual_end_date = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('work_orders')
      .update(updateData)
      .eq('id', work_order_id);

    if (updateError) {
      throw new Error(`更新工单失败: ${updateError.message}`);
    }

    // Create progress log
    const { data: logData, error: logError } = await supabase
      .from('progress_logs')
      .insert({
        work_order_id,
        operator_id: user.id,
        operator_name: user.nickname || user.phone,
        action,
        completed_delta: completed_delta || 0,
        remark: remark || null,
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`记录进度日志失败: ${logError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        work_order: { ...workOrder, status: newStatus, completed_quantity: newCompletedQuantity },
        log: logData,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    console.error('进度上报失败:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
