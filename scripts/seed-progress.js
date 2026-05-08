// Seed script for work_orders and progress_logs
const SUPABASE_URL = 'https://cdcnjtgabgjkouavwxsl.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY25qdGdhYmdqa291YXZ3eHNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg1MjM0MSwiZXhwIjoyMDkzNDI4MzQxfQ.LzvwvnkQx_lIjIjsZd8FxyXRaDwTPyiVELyTEuTacmE';
const TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // 青崖官方

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const headersMinimal = {
  ...headers,
  Prefer: 'return=minimal',
};

async function getJSON(url) {
  const res = await fetch(url, { headers });
  return res.json();
}

async function postJSON(table, data, minimal = false) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: minimal ? headersMinimal : headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`POST ${table} failed:`, errText);
    return null;
  }
  if (minimal) return null;
  return res.json();
}

async function seed() {
  // 1. Create workshops
  console.log('Creating workshops...');
  let workshops = await getJSON(`${SUPABASE_URL}/rest/v1/workshops?select=id,name,code`);
  
  if (workshops.length === 0) {
    const workshopsData = [
      { tenant_id: TENANT_ID, name: '下料车间', code: 'XL' },
      { tenant_id: TENANT_ID, name: '组装车间', code: 'ZZ' },
      { tenant_id: TENANT_ID, name: '涂装车间', code: 'TZ' },
      { tenant_id: TENANT_ID, name: '包装车间', code: 'BZ' },
    ];
    workshops = await postJSON('workshops', workshopsData);
    console.log('Created workshops:', workshops?.length || 0);
  } else {
    console.log('Workshops already exist:', workshops.length);
  }

  // 2. Ensure orders exist
  console.log('Checking orders...');
  let orders = await getJSON(`${SUPABASE_URL}/rest/v1/orders?select=id,order_no,customer_name&limit=10`);
  
  if (orders.length === 0) {
    const ordersData = [
      { tenant_id: TENANT_ID, order_no: 'QY-2025-001', customer_name: '张先生', status: 'in_production', delivery_date: '2025-08-15', total_amount: 128000 },
      { tenant_id: TENANT_ID, order_no: 'QY-2025-002', customer_name: '李女士', status: 'in_production', delivery_date: '2025-07-20', total_amount: 86000 },
      { tenant_id: TENANT_ID, order_no: 'QY-2025-003', customer_name: '王总', status: 'pending', delivery_date: '2025-09-01', total_amount: 256000 },
      { tenant_id: TENANT_ID, order_no: 'QY-2025-004', customer_name: '赵经理', status: 'in_production', delivery_date: '2025-07-10', total_amount: 45000 },
      { tenant_id: TENANT_ID, order_no: 'QY-2025-005', customer_name: '陈总', status: 'completed', delivery_date: '2025-06-30', total_amount: 168000 },
    ];
    orders = await postJSON('orders', ordersData);
    console.log('Created orders:', orders?.length || 0);
  } else {
    console.log('Orders already exist:', orders.length);
  }

  // 3. Check existing work orders
  console.log('Checking work orders...');
  const existingWO = await getJSON(`${SUPABASE_URL}/rest/v1/work_orders?select=id&limit=1`);

  if (existingWO.length > 0) {
    console.log('Work orders already exist, skipping.');
    return;
  }

  if (!workshops || workshops.length === 0 || !orders || orders.length === 0) {
    console.error('Cannot create work orders: missing workshops or orders');
    return;
  }

  // 4. Create work orders
  const now = new Date();
  const workOrdersData = [
    {
      order_id: orders[0].id,
      workshop_id: workshops[0].id,
      product_name: '定制衣柜-主卧',
      target_quantity: 3,
      completed_quantity: 2,
      status: 'producing',
      priority: 'urgent',
      expected_end_date: new Date(now.getTime() - 2 * 86400000).toISOString().split('T')[0],
      remark: '客户要求加急',
      created_by: '00000000-0000-0000-0000-000000000000',
    },
    {
      order_id: orders[0].id,
      workshop_id: workshops[1].id,
      product_name: '定制衣柜-次卧',
      target_quantity: 2,
      completed_quantity: 2,
      status: 'inspecting',
      priority: 'normal',
      expected_end_date: new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0],
      remark: null,
      created_by: '00000000-0000-0000-0000-000000000000',
    },
    {
      order_id: orders[1].id,
      workshop_id: workshops[0].id,
      product_name: '定制橱柜-L型',
      target_quantity: 1,
      completed_quantity: 0,
      status: 'pending',
      priority: 'high',
      expected_end_date: new Date(now.getTime() + 3 * 86400000).toISOString().split('T')[0],
      remark: '特殊板材需确认',
      created_by: '00000000-0000-0000-0000-000000000000',
    },
    {
      order_id: orders[1].id,
      workshop_id: workshops[2].id,
      product_name: '定制书柜-满墙',
      target_quantity: 1,
      completed_quantity: 1,
      status: 'stored',
      priority: 'normal',
      expected_end_date: new Date(now.getTime() - 1 * 86400000).toISOString().split('T')[0],
      remark: null,
      created_by: '00000000-0000-0000-0000-000000000000',
    },
    {
      order_id: orders[2].id,
      workshop_id: workshops[1].id,
      product_name: '定制酒柜-嵌入式',
      target_quantity: 2,
      completed_quantity: 1,
      status: 'producing',
      priority: 'normal',
      expected_end_date: new Date(now.getTime() + 10 * 86400000).toISOString().split('T')[0],
      remark: null,
      created_by: '00000000-0000-0000-0000-000000000000',
    },
    {
      order_id: orders[2].id,
      workshop_id: workshops[0].id,
      product_name: '定制鞋柜-玄关',
      target_quantity: 1,
      completed_quantity: 0,
      status: 'pending',
      priority: 'low',
      expected_end_date: new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0],
      remark: '常规款',
      created_by: '00000000-0000-0000-0000-000000000000',
    },
    {
      order_id: orders[3].id,
      workshop_id: workshops[2].id,
      product_name: '定制电视柜-悬空',
      target_quantity: 1,
      completed_quantity: 0,
      status: 'aborted',
      priority: 'high',
      expected_end_date: new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0],
      remark: '客户变更设计，暂停生产',
      created_by: '00000000-0000-0000-0000-000000000000',
    },
    {
      order_id: orders[3].id,
      workshop_id: workshops[3].id,
      product_name: '定制阳台柜',
      target_quantity: 1,
      completed_quantity: 0,
      status: 'pending',
      priority: 'urgent',
      expected_end_date: new Date(now.getTime() + 1 * 86400000).toISOString().split('T')[0],
      remark: '需优先处理',
      created_by: '00000000-0000-0000-0000-000000000000',
    },
    {
      order_id: orders[4].id,
      workshop_id: workshops[1].id,
      product_name: '定制衣帽间-U型',
      target_quantity: 1,
      completed_quantity: 1,
      status: 'stored',
      priority: 'normal',
      expected_end_date: new Date(now.getTime() - 3 * 86400000).toISOString().split('T')[0],
      remark: null,
      created_by: '00000000-0000-0000-0000-000000000000',
    },
  ];

  console.log('Creating work orders...');
  const createdWO = await postJSON('work_orders', workOrdersData);
  console.log('Created work orders:', createdWO?.length || 0);

  // 5. Create progress logs
  if (createdWO && createdWO.length > 0) {
    console.log('Creating progress logs...');
    const now2 = new Date();
    const allLogs = [];

    for (const wo of createdWO) {
      allLogs.push({
        work_order_id: wo.id,
        operator_id: '00000000-0000-0000-0000-000000000000',
        operator_name: '系统初始化',
        action: 'start',
        completed_delta: 0,
        remark: '工单创建',
        created_at: new Date(now2.getTime() - 7 * 86400000).toISOString(),
      });

      if (wo.status === 'producing' || wo.status === 'inspecting' || wo.status === 'stored') {
        allLogs.push({
          work_order_id: wo.id,
          operator_id: '00000000-0000-0000-0000-000000000000',
          operator_name: '下料组长-老王',
          action: 'complete_cutting',
          completed_delta: 0,
          remark: '下料完成，尺寸已复核',
          created_at: new Date(now2.getTime() - 5 * 86400000).toISOString(),
        });
      }

      if (wo.completed_quantity > 0) {
        allLogs.push({
          work_order_id: wo.id,
          operator_id: '00000000-0000-0000-0000-000000000000',
          operator_name: '组装组长-小李',
          action: 'report_progress',
          completed_delta: wo.completed_quantity,
          remark: Number(wo.completed_quantity) < Number(wo.target_quantity) ? '部分完成，剩余排产中' : '全部完成',
          created_at: new Date(now2.getTime() - 3 * 86400000).toISOString(),
        });
      }

      if (wo.status === 'inspecting' || wo.status === 'stored') {
        allLogs.push({
          work_order_id: wo.id,
          operator_id: '00000000-0000-0000-0000-000000000000',
          operator_name: '组装组长-小李',
          action: 'complete_assembly',
          completed_delta: 0,
          remark: '组装完成',
          created_at: new Date(now2.getTime() - 2 * 86400000).toISOString(),
        });
      }

      if (wo.status === 'stored') {
        allLogs.push({
          work_order_id: wo.id,
          operator_id: '00000000-0000-0000-0000-000000000000',
          operator_name: '质检员-小张',
          action: 'quality_check',
          completed_delta: 0,
          remark: '质检通过',
          created_at: new Date(now2.getTime() - 1 * 86400000).toISOString(),
        });
        allLogs.push({
          work_order_id: wo.id,
          operator_id: '00000000-0000-0000-0000-000000000000',
          operator_name: '仓管-小陈',
          action: 'warehouse_in',
          completed_delta: 0,
          remark: '已入库A区3号架',
          created_at: now2.toISOString(),
        });
      }

      if (wo.status === 'aborted') {
        allLogs.push({
          work_order_id: wo.id,
          operator_id: '00000000-0000-0000-0000-000000000000',
          operator_name: '生产主管-老刘',
          action: 'abort',
          completed_delta: 0,
          remark: '客户变更设计，暂停生产，等待重新排产',
          created_at: new Date(now2.getTime() - 1 * 86400000).toISOString(),
        });
      }
    }

    await postJSON('progress_logs', allLogs, true);
    console.log('Created progress logs:', allLogs.length);
  }

  console.log('Seed complete!');
}

seed().catch(console.error);
