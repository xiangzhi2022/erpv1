'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
  enabled?: boolean;
}

export default function WageRulesPage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [ruleName, setRuleName] = useState('');
  const [taskType, setTaskType] = useState('process');
  const [processName, setProcessName] = useState('');
  const [method, setMethod] = useState('by_piece');
  const [unit, setUnit] = useState('件');
  const [unitPrice, setUnitPrice] = useState('0');

  const load = async () => {
    const res = await fetch('/api/wage-rules');
    const json = await res.json();
    if (json.success) setRules(json.data || []);
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const createRule = async () => {
    const res = await fetch('/api/wage-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rule_name: ruleName,
        task_type: taskType,
        process_name: processName || null,
        calculation_method: method,
        unit,
        unit_price: Number(unitPrice || 0),
      }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '创建失败');
    setRuleName('');
    setProcessName('');
    setUnitPrice('0');
    toast.success('工资规则已创建');
    await load();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">工资规则</h1>
        <p className="text-sm text-muted-foreground">配置板件、工序、安装、包装等计件工资单价。</p>
      </div>
      <Card>
        <CardHeader><CardTitle>新增规则</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="space-y-2 md:col-span-2">
            <Label>规则名称</Label>
            <Input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="板件开料" />
          </div>
          <div className="space-y-2">
            <Label>任务类型</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['board', 'door', 'hardware', 'process', 'install', 'package', 'delivery'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>工序</Label>
            <Input value={processName} onChange={(event) => setProcessName(event.target.value)} placeholder="封边" />
          </div>
          <div className="space-y-2">
            <Label>方式</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['by_piece', 'by_area', 'by_meter', 'by_set', 'fixed'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>单价</Label>
            <Input value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} type="number" min="0" step="0.01" />
          </div>
          <div className="space-y-2">
            <Label>单位</Label>
            <Input value={unit} onChange={(event) => setUnit(event.target.value)} />
          </div>
          <div className="md:col-span-6">
            <Button disabled={!ruleName.trim()} onClick={createRule}>保存规则</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>规则列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>工序</TableHead>
                <TableHead>方式</TableHead>
                <TableHead>单价</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.rule_name}</TableCell>
                  <TableCell>{rule.task_type}</TableCell>
                  <TableCell>{rule.process_name || '-'}</TableCell>
                  <TableCell>{rule.calculation_method}</TableCell>
                  <TableCell>{rule.unit_price} / {rule.unit}</TableCell>
                  <TableCell>{rule.enabled ? '启用' : '禁用'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => toggleRule(rule)}>{rule.enabled ? '禁用' : '启用'}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
