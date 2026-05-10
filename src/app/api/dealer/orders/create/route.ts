import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { cookies } from "next/headers";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userStr = cookieStore.get("erp_user")?.value;
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

interface OrderItemInput {
  productName: string;
  specification?: string;
  quantity: number;
  unitPrice: number;
}

interface RequestBody {
  customerName: string;
  customerPhone: string;
  deliveryDate?: string;
  targetFactoryId: string;
  items: OrderItemInput[];
  remark?: string;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    // 权限检查：经销商管理员或系统管理员可创建订单
    const allowedRoles = ["dealer_admin", "super_admin", "saas_admin"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ success: false, error: "无权限创建订单" }, { status: 403 });
    }

    const body: RequestBody = await request.json();
    const { customerName, customerPhone, deliveryDate, targetFactoryId, items, remark } = body;

    // 必填字段校验
    if (!customerName?.trim()) {
      return NextResponse.json({ success: false, error: "客户名称不能为空" }, { status: 400 });
    }
    if (!targetFactoryId) {
      return NextResponse.json({ success: false, error: "请选择目标工厂" }, { status: 400 });
    }
    if (!items?.length) {
      return NextResponse.json({ success: false, error: "请添加至少一个产品项" }, { status: 400 });
    }
    // 校验每个明细项
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productName?.trim()) {
        return NextResponse.json({ success: false, error: `第${i + 1}项产品名称不能为空` }, { status: 400 });
      }
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json({ success: false, error: `第${i + 1}项数量必须大于0` }, { status: 400 });
      }
      if (item.unitPrice < 0) {
        return NextResponse.json({ success: false, error: `第${i + 1}项单价不能为负` }, { status: 400 });
      }
    }

    const supabase = getSupabaseClient();

    // 生成订单号：使用与 /api/orders/generate 一致的逻辑
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = "ORD";

    // 查询当天最大的序号
    const startDate = `${dateStr}000000`;
    const endDate = `${dateStr}235959`;
    const { data: existingOrders } = await supabase
      .from("orders")
      .select("order_no")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .like("order_no", `${prefix}${dateStr}%`)
      .order("order_no", { ascending: false })
      .limit(1);

    let sequence = 1;
    if (existingOrders && existingOrders.length > 0) {
      const lastNo = existingOrders[0].order_no as string;
      const match = lastNo.match(/^(\D*)(\d{8})(\d+)$/);
      if (match && match[2] === dateStr) {
        sequence = parseInt(match[3], 10) + 1;
      }
    }

    const orderNo = `${prefix}${dateStr}${String(sequence).padStart(4, "0")}`;

    // 创建订单 — 字段与 Drizzle schema 对齐
    // orders schema: id, order_no, customer_name, customer_phone, status,
    //   total_amount, tenant_id, target_factory_id, delivery_date, remark, created_at, updated_at
    const tenantId = user.tenant_id || null;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_no: orderNo,
        customer_name: customerName.trim(),
        customer_phone: customerPhone?.trim() || null,
        status: "pending",
        target_factory_id: targetFactoryId,
        tenant_id: tenantId,
        delivery_date: deliveryDate || null,
        remark: remark?.trim() || null,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("创建订单失败:", orderError);
      return NextResponse.json({ success: false, error: "创建订单失败" }, { status: 500 });
    }

    // 创建订单明细 — 字段与 Drizzle schema 对齐
    // order_items schema: id, order_id, product_name, specifications, quantity,
    //   unit_price, unit, remark, created_at
    let totalAmount = 0;
    const itemInserts = items.map((item) => {
      const subtotal = item.quantity * item.unitPrice;
      totalAmount += subtotal;
      return {
        order_id: order.id,
        product_name: item.productName.trim(),
        specifications: item.specification?.trim() || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        unit: "件",
      };
    });

    const { error: itemsError } = await supabase.from("order_items").insert(itemInserts);

    if (itemsError) {
      console.error("创建订单明细失败:", itemsError);
      // 回滚：删除刚创建的订单
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ success: false, error: "创建订单明细失败" }, { status: 500 });
    }

    // 更新订单总金额
    await supabase
      .from("orders")
      .update({ total_amount: totalAmount })
      .eq("id", order.id);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNo: order.order_no,
        status: order.status,
      },
    });
  } catch (error) {
    console.error("创建订单失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
