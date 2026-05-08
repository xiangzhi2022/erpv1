import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

interface RequestBody {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryDate?: string;
  targetFactoryId: string;
  items: {
    productName: string;
    specification?: string;
    quantity: number;
    unitPrice: number;
  }[];
  remark?: string;
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (user.role !== "dealer_admin") {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const body: RequestBody = await request.json();
    const { customerName, customerPhone, customerAddress, deliveryDate, targetFactoryId, items, remark } = body;

    if (!customerName || !customerPhone || !customerAddress || !targetFactoryId || !items?.length) {
      return NextResponse.json({ success: false, error: "缺少必填字段" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 生成订单号
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    // 获取或创建序列号
    let seq = 1;
    const { data: seqData, error: seqError } = await supabase
      .from("sequences")
      .select("current_value")
      .eq("prefix", "ORD")
      .eq("date_part", dateStr)
      .single();

    if (seqData) {
      seq = seqData.current_value + 1;
      await supabase
        .from("sequences")
        .update({ current_value: seq })
        .eq("prefix", "ORD")
        .eq("date_part", dateStr);
    } else {
      await supabase.from("sequences").insert({
        id: `seq_ORD_${dateStr}`,
        prefix: "ORD",
        date_part: dateStr,
        current_value: 1
      });
    }

    const orderNo = `ORD${dateStr}${String(seq).padStart(4, "0")}`;

    // 创建订单
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_no: orderNo,
        dealer_id: user.tenant_id,
        target_factory_id: targetFactoryId,
        status: "pending",
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        delivery_date: deliveryDate || null,
        remark: remark || null,
        created_by: user.id
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: "创建订单失败" }, { status: 500 });
    }

    // 创建订单明细
    let totalAmount = 0;
    for (const item of items) {
      const subtotal = item.quantity * item.unitPrice;
      totalAmount += subtotal;

      await supabase.from("order_items").insert({
        order_id: order.id,
        product_name: item.productName,
        specification: item.specification || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: subtotal
      });
    }

    // 更新订单总金额
    await supabase
      .from("orders")
      .update({ total_amount: totalAmount })
      .eq("id", order.id);

    // 为每个工序创建生产任务
    const stations = ["开料", "封边", "打孔", "包装", "质检"];
    for (const station of stations) {
      await supabase.from("production_tasks").insert({
        task_no: `${orderNo}-${station}`,
        order_id: order.id,
        factory_id: targetFactoryId,
        station: station,
        progress: "pending"
      });
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNo: order.order_no,
        status: order.status
      }
    });
  } catch (error) {
    console.error("创建订单失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
