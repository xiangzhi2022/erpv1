import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { progressReportSchema, WorkOrderStatus } from '@/app/progress/schemas';

// Status transition map: action -> new status
// Aligned with WorkOrderStatus enum: pending, scheduling, producing, inspecting, stored, aborted
const ACTION_STATUS_MAP: Record<string, string> = {
  start: WorkOrderStatus.PRODUCING,
  complete_cutting: WorkOrderStatus.PRODUCING,
  complete_assembly: WorkOrderStatus.PRODUCING,
  complete_painting: WorkOrderStatus.PRODUCING,
  quality_check: WorkOrderStatus.INSPECTING,
  warehouse_in: WorkOrderStatus.STORED,
  report_progress: '', // keep current status
  report_defect: '',   // keep current status
  pause: WorkOrderStatus.PENDING,
  resume: WorkOrderStatus.PRODUCING,
  abort: WorkOrderStatus.ABORTED,
};

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
      .maybeSingle();

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
    let newStatus: string;
    const mappedStatus = ACTION_STATUS_MAP[action];

    if (mappedStatus === '') {
      // Actions that keep current status (report_progress, report_defect)
      newStatus = workOrder.status;
    } else {
      newStatus = mappedStatus;
    }

    // Auto-transition: if target reached and not abort/warehouse_in, go to inspecting
    // warehouse_in should always go to stored regardless of target
    if (newCompletedQuantity >= workOrder.target_quantity && action !== 'abort' && action !== 'warehouse_in') {
      // If the mapped status is not a terminal state, auto-advance to inspecting
      if (newStatus !== WorkOrderStatus.STORED && newStatus !== WorkOrderStatus.ABORTED) {
        newStatus = WorkOrderStatus.INSPECTING;
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      completed_quantity: newCompletedQuantity,
      updated_at: new Date().toISOString(),
    };

    // Set start_date when first entering producing
    if (newStatus === WorkOrderStatus.PRODUCING && workOrder.status !== WorkOrderStatus.PRODUCING) {
      updateData.start_date = new Date().toISOString();
    }

    // Set actual_end_date when entering stored
    if (newStatus === WorkOrderStatus.STORED) {
      updateData.actual_end_date = new Date().toISOString();
    }

    // Update work order
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
      .maybeSingle();

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
