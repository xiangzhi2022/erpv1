'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RuleRow {
  id: string;
  rule_name?: string;
  task_type?: string;
  process_name?: string | null;
  unit?: string;
  unit_price?: number | string;
  calculation_method?: string;
  scope_type?: string | null;
  worker_id?: string | null;
  position_id?: string | null;
  product_type?: string | null;
  extra_amount?: number | string | null;
  enabled?: boolean;
}

interface WorkerOption {
  id: string;
  name?: string | null;
  worker_no?: string | null;
  craft_type?: string | null;
}

interface PositionOption {
  id: string;
  name?: string | null;
  code?: string | null;
}

interface RuleForm {
  rule_name: string;
  scope_type: 'company' | 'position' | 'worker';
  worker_id: string;
  position_id: string;
  task_type: string;
  product_type: string;
  process_name: string;
  calculation_method: string;
  unit: string;
  unit_price: string;
  extra_amount: string;
}

const taskTypeOptions = [
  { value: 'board', label: '板材' },
  { value: 'door', label: '门/套' },
  { value: 'special', label: '特殊件' },
  { value: 'hardware', label: '五金' },
  { value: 'process', label: '工序' },
  { value: 'install', label: '安装' },
  { value: 'package', label: '包装' },
  { value: 'delivery', label: '发货' },
];

const productTypeOptions = [
  { value: 'none', label: '不限项目' },
  { value: 'board', label: '板材/柜体' },
  { value: 'door', label: '门板/门套' },
  { value: 'special', label: '特殊件' },
  { value: 'hardware', label: '五金' },
  { value: 'install', label: '安装' },
  { value: 'package', label: '包装' },
];

const methodOptions = [
  { value: 'by_piece', label: '按件/块' },
  { value: 'by_area', label: '按平方' },
  { value: 'by_meter', label: '按米' },
  { value: 'by_set', label: '按套/趟' },
  { value: 'fixed', label: '固定金额' },
];

const scopeLabels: Record<string, string> = {
  company: '企业通用',
  position: '岗位规则',
  worker: '个人规则',
};

function defaultMethod(taskType: string): string {
  if (taskType === 'board') return 'by_area';
  if (taskType === 'door' || taskType === 'install' || taskType === 'delivery') return 'by_set';
  if (taskType === 'special') return 'fixed';
  return 'by_piece';
}

function defaultUnit(taskType: string): string {
  if (taskType === 'board') return '平方';
  if (taskType === 'door' || taskType === 'install' || taskType === 'delivery') return '套';
  if (taskType === 'by_meter') return '米';
  return '件';
}

function money(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '-';
}

const emptyForm: RuleForm = {
  rule_name: '',
  scope_type: 'company',
  worker_id: 'none',
  position_id: 'none',
  task_type: 'board',
  product_type: 'none',
  process_name: '',
  calculation_method: 'by_area',
  unit: '平方',
  unit_price: '0',
  extra_amount: '0',
};

export default function WageRulesPage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);

  const workerMap = useMemo(() => new Map(workers.map((worker) => [worker.id, worker])), [workers]);
  const positionMap = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);

  const load = async () => {
    const res = await fetch('/api/wage-rules?include_options=1');
    const json = await res.json();
    if (!res.ok || !json.success) {
      setForbidden(res.status === 403);
      toast.error(json.error || '获取工资管理规则失败');
      return;
    }
    setForbidden(false);
    setRules(json.data || []);
    setWorkers(json.options?.workers || []);
    setPositions(json.options?.positions || []);
  };

  useEffect(() => {
    load().catch(() => toast.error('获取工资管理规则失败'));
  }, []);

  const updateTaskType = (taskType: string) => {
    setForm((current) => ({
      ...current,
      task_type: taskType,
      calculation_method: defaultMethod(taskType),
      unit: defaultUnit(taskType),
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const saveRule = async () => {
    if (!form.rule_name.trim()) return toast.error('请填写规则名称');
    if (form.scope_type === 'worker' && form.worker_id === 'none') return toast.error('个人规则必须选择工人');
    if (form.scope_type === 'position' && form.position_id === 'none') return toast.error('岗位规则必须选择岗位');

    setLoading(true);
    const payload = {
      rule_name: form.rule_name.trim(),
      scope_type: form.scope_type,
      worker_id: form.scope_type === 'worker' ? form.worker_id : null,
      position_id: form.scope_type === 'position' ? form.position_id : null,
      task_type: form.task_type,
      product_type: form.product_type === 'none' ? null : form.product_type,
      process_name: form.process_name.trim() || null,
      calculation_method: form.calculation_method,
      unit: form.unit.trim() || defaultUnit(form.task_type),
      unit_price: Number(form.unit_price || 0),
      extra_amount: Number(form.extra_amount || 0),
    };

    try {
      const res = await fetch(editingId ? `/api/wage-rules/${editingId}` : '/api/wage-rules', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) return toast.error(json.error || '保存失败');
      toast.success(editingId ? '工资管理规则已更新' : '工资管理规则已创建');
      resetForm();
      await load();
    } finally {
      setLoading(false);
    }
  };

  const editRule = (rule: RuleRow) => {
    const taskType = rule.task_type || 'board';
    setEditingId(rule.id);
    setForm({
      rule_name: rule.rule_name || '',
      scope_type: rule.scope_type === 'worker' || rule.scope_type === 'position' ? rule.scope_type : 'company',
      worker_id: rule.worker_id || 'none',
      position_id: rule.position_id || 'none',
      task_type: taskType,
      product_type: rule.product_type || 'none',
      process_name: rule.process_name || '',
      calculation_method: rule.calculation_method || defaultMethod(taskType),
      unit: rule.unit || defaultUnit(taskType),
      unit_price: String(rule.unit_price ?? '0'),
      extra_amount: String(rule.extra_amount ?? '0'),
    });
  };

  const toggleRule = async (rule: RuleRow) => {
    const res = await fetch(`/api/wage-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '更新失败');
    await load();
  };

  const deleteRule = async (rule: RuleRow) => {
    const res = await fetch(`/api/wage-rules/${rule.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '删除失败');
    if (editingId === rule.id) resetForm();
    toast.success('规则已删除');
    await load();
  };

  if (forbidden) {
    return (
      <div className="rounded-lg border p-6">
        <h1 className="text-xl font-semibold">工资管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">只有本工厂 ERP 管理员和老板可以配置工资规则。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">工资管理</h1>
        <p className="text-sm text-muted-foreground">按工厂企业配置计件规则，支持企业通用、岗位和个人工人工资规则。</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{editingId ? '编辑工资规则' : '新增工资规则'}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="space-y-2 md:col-span-2">
            <Label>规则名称</Label>
            <Input value={form.rule_name} onChange={(event) => setForm({ ...form, rule_name: event.target.value })} placeholder="板材按平方计件" />
          </div>
          <div className="space-y-2">
            <Label>适用范围</Label>
            <Select value={form.scope_type} onValueChange={(value) => setForm({ ...form, scope_type: value as RuleForm['scope_type'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">企业通用</SelectItem>
                <SelectItem value="position">岗位规则</SelectItem>
                <SelectItem value="worker">个人规则</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.scope_type === 'position' ? (
            <div className="space-y-2">
              <Label>岗位</Label>
              <Select value={form.position_id} onValueChange={(value) => setForm({ ...form, position_id: value })}>
                <SelectTrigger><SelectValue placeholder="选择岗位" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">选择岗位</SelectItem>
                  {positions.map((position) => <SelectItem key={position.id} value={position.id}>{position.name || position.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {form.scope_type === 'worker' ? (
            <div className="space-y-2">
              <Label>工人</Label>
              <Select value={form.worker_id} onValueChange={(value) => setForm({ ...form, worker_id: value })}>
                <SelectTrigger><SelectValue placeholder="选择工人" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">选择工人</SelectItem>
                  {workers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name || worker.worker_no}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>拆单任务类型</Label>
            <Select value={form.task_type} onValueChange={updateTaskType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {taskTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>项目匹配</Label>
            <Select value={form.product_type} onValueChange={(value) => setForm({ ...form, product_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {productTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>工序</Label>
            <Input value={form.process_name} onChange={(event) => setForm({ ...form, process_name: event.target.value })} placeholder="开料 / 封边 / 打孔" />
          </div>
          <div className="space-y-2">
            <Label>计算方式</Label>
            <Select value={form.calculation_method} onValueChange={(value) => setForm({ ...form, calculation_method: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {methodOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>单价</Label>
            <Input value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} type="number" min="0" step="0.01" />
          </div>
          <div className="space-y-2">
            <Label>单位</Label>
            <Input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>额外金额</Label>
            <Input value={form.extra_amount} onChange={(event) => setForm({ ...form, extra_amount: event.target.value })} type="number" min="0" step="0.01" />
          </div>
          <div className="flex items-end gap-2 md:col-span-6">
            <Button disabled={loading || !form.rule_name.trim()} onClick={saveRule}>{editingId ? '保存修改' : '保存规则'}</Button>
            {editingId ? <Button variant="outline" onClick={resetForm}>取消编辑</Button> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>工资规则列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>规则</TableHead>
                <TableHead>范围</TableHead>
                <TableHead>拆单任务</TableHead>
                <TableHead>工序</TableHead>
                <TableHead>方式</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const worker = rule.worker_id ? workerMap.get(rule.worker_id) : null;
                const position = rule.position_id ? positionMap.get(rule.position_id) : null;
                const scopeText = rule.scope_type === 'worker'
                  ? `个人：${worker?.name || rule.worker_id}`
                  : rule.scope_type === 'position'
                    ? `岗位：${position?.name || rule.position_id}`
                    : scopeLabels.company;
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.rule_name}</TableCell>
                    <TableCell>{scopeText}</TableCell>
                    <TableCell>{taskTypeOptions.find((item) => item.value === rule.task_type)?.label || rule.task_type}</TableCell>
                    <TableCell>{rule.process_name || '不限'}</TableCell>
                    <TableCell>{methodOptions.find((item) => item.value === rule.calculation_method)?.label || rule.calculation_method}</TableCell>
                    <TableCell>{money(rule.unit_price)} / {rule.unit || '件'}{Number(rule.extra_amount || 0) > 0 ? ` + ${money(rule.extra_amount)}` : ''}</TableCell>
                    <TableCell><Badge variant={rule.enabled ? 'secondary' : 'outline'}>{rule.enabled ? '启用' : '禁用'}</Badge></TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => editRule(rule)}>编辑</Button>
                      <Button size="sm" variant="outline" onClick={() => toggleRule(rule)}>{rule.enabled ? '禁用' : '启用'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRule(rule)}>删除</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rules.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">暂无工资管理规则</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
