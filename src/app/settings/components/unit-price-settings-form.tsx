'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  type FinishType,
  type FormingMethod,
  type UnitPriceRule,
  type UnitPriceRuleCategory,
  type UnitPriceRuleUnit,
  unitPriceSettingsSchema,
} from '../schemas';

const SETTINGS_KEY = 'unit_price_settings';

const categoryOptions: Array<{ value: UnitPriceRuleCategory; label: string }> = [
  { value: 'material_thickness', label: '材料厚度' },
  { value: 'process', label: '工艺' },
  { value: 'finish', label: '表面处理' },
  { value: 'veneer', label: '贴皮' },
  { value: 'handleless', label: '免拉手' },
  { value: 'forming', label: '成型工艺' },
];

const unitOptions: Array<{ value: UnitPriceRuleUnit; label: string }> = [
  { value: 'sqm', label: '元/平方' },
  { value: 'm', label: '元/米' },
  { value: 'piece', label: '元/件' },
  { value: 'set', label: '元/套' },
];

const finishOptions: Array<{ value: FinishType; label: string }> = [
  { value: 'mixed_oil', label: '混油' },
  { value: 'veneer', label: '贴皮' },
];

const formingOptions: Array<{ value: FormingMethod; label: string }> = [
  { value: 'pressing', label: '压制' },
  { value: 'direct_cut', label: '直裁' },
];

const defaultRules: UnitPriceRule[] = [
  {
    id: 'material-18mm',
    category: 'material_thickness',
    name: '18mm 板材',
    thicknessMm: 18,
    unit: 'sqm',
    unitPrice: 0,
    note: '',
    enabled: true,
  },
  {
    id: 'finish-mixed-oil',
    category: 'finish',
    name: '混油',
    finishType: 'mixed_oil',
    unit: 'sqm',
    unitPrice: 0,
    note: '',
    enabled: true,
  },
  {
    id: 'veneer-06mm',
    category: 'veneer',
    name: '0.6mm 木皮',
    finishType: 'veneer',
    veneerThicknessMm: 0.6,
    unit: 'sqm',
    unitPrice: 0,
    note: '',
    enabled: true,
  },
  {
    id: 'handleless-standard',
    category: 'handleless',
    name: '免拉手',
    unit: 'm',
    unitPrice: 0,
    note: '',
    enabled: true,
  },
  {
    id: 'forming-pressing',
    category: 'forming',
    name: '抗变形铺料压制',
    formingMethod: 'pressing',
    unit: 'sqm',
    unitPrice: 0,
    note: '上层薄板、下层薄板，中间按抗变形方式铺料后压制。',
    enabled: true,
  },
  {
    id: 'forming-direct-cut',
    category: 'forming',
    name: '预制板直裁',
    formingMethod: 'direct_cut',
    unit: 'sqm',
    unitPrice: 0,
    note: '预制板材厚度一致，直接用大板裁切。',
    enabled: true,
  },
];

function isRuleCategory(value: string): value is UnitPriceRuleCategory {
  return categoryOptions.some((option) => option.value === value);
}

function isRuleUnit(value: string): value is UnitPriceRuleUnit {
  return unitOptions.some((option) => option.value === value);
}

function isFinishType(value: string): value is FinishType {
  return finishOptions.some((option) => option.value === value);
}

function isFormingMethod(value: string): value is FormingMethod {
  return formingOptions.some((option) => option.value === value);
}

function makeRuleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `price-${new Date().getTime()}`;
}

function parseStoredSettings(value: string | undefined): UnitPriceRule[] {
  if (!value) return defaultRules;

  try {
    const parsed: unknown = JSON.parse(value);
    const result = unitPriceSettingsSchema.safeParse(parsed);
    return result.success ? result.data.rules : defaultRules;
  } catch {
    return defaultRules;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getPreferenceValue(payload: unknown, key: string): string | undefined {
  if (!isRecord(payload) || !('preferences' in payload)) return undefined;
  const preferences = payload.preferences;
  if (!isRecord(preferences) || !(key in preferences)) return undefined;
  const value = preferences[key];
  return typeof value === 'string' ? value : undefined;
}

function cleanRuleForCategory(rule: UnitPriceRule, category: UnitPriceRuleCategory): UnitPriceRule {
  const base: UnitPriceRule = {
    id: rule.id,
    category,
    name: rule.name,
    unit: rule.unit,
    unitPrice: rule.unitPrice,
    note: rule.note,
    enabled: rule.enabled,
  };

  if (category === 'material_thickness') return { ...base, thicknessMm: rule.thicknessMm ?? 18 };
  if (category === 'finish') return { ...base, finishType: rule.finishType ?? 'mixed_oil' };
  if (category === 'veneer') return { ...base, finishType: 'veneer', veneerThicknessMm: rule.veneerThicknessMm ?? 0.6 };
  if (category === 'forming') return { ...base, formingMethod: rule.formingMethod ?? 'pressing' };
  return base;
}

function formatRuleMeta(rule: UnitPriceRule): string {
  if (rule.category === 'material_thickness') return `${rule.thicknessMm ?? '-'}mm`;
  if (rule.category === 'veneer') return `${rule.veneerThicknessMm ?? '-'}mm 木皮`;
  if (rule.category === 'finish') return rule.finishType === 'mixed_oil' ? '混油' : '贴皮';
  if (rule.category === 'forming') return rule.formingMethod === 'pressing' ? '压制' : '直裁';
  return '-';
}

export function UnitPriceSettingsForm() {
  const [rules, setRules] = useState<UnitPriceRule[]>(defaultRules);
  const [initialRules, setInitialRules] = useState<UnitPriceRule[]>(defaultRules);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(initialRules),
    [rules, initialRules]
  );

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/preferences');
      const data: unknown = await response.json();
      const loadedRules = parseStoredSettings(getPreferenceValue(data, SETTINGS_KEY));
      setRules(loadedRules);
      setInitialRules(loadedRules);
    } catch {
      toast.error('加载单价设置失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateRule = (id: string, next: Partial<UnitPriceRule>) => {
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...next } : rule)));
  };

  const updateRuleCategory = (id: string, value: string) => {
    if (!isRuleCategory(value)) return;
    setRules((current) =>
      current.map((rule) => (rule.id === id ? cleanRuleForCategory(rule, value) : rule))
    );
  };

  const addRule = () => {
    setRules((current) => [
      ...current,
      {
        id: makeRuleId(),
        category: 'material_thickness',
        name: '新单价规则',
        thicknessMm: 18,
        unit: 'sqm',
        unitPrice: 0,
        note: '',
        enabled: true,
      },
    ]);
  };

  const removeRule = (id: string) => {
    setRules((current) => current.filter((rule) => rule.id !== id));
  };

  const saveSettings = async () => {
    const result = unitPriceSettingsSchema.safeParse({ rules });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message || '请检查单价规则');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SETTINGS_KEY, value: result.data }),
      });
      const data: unknown = await response.json();
      const success = typeof data === 'object' && data !== null && 'success' in data && data.success === true;

      if (!success) {
        toast.error('保存单价设置失败');
        return;
      }

      setInitialRules(result.data.rules);
      setRules(result.data.rules);
      toast.success('单价设置已保存');
    } catch {
      toast.error('保存单价设置失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-2 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>单价设置</CardTitle>
            <CardDescription>
              设置不同厚度、工艺、表面处理、免拉手和成型方式的销售单价。
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={addRule}>
            <Plus className="h-4 w-4" />
            新增规则
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-md border bg-background p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid min-w-0 flex-1 basis-40 gap-1">
                  <Label className="text-xs text-muted-foreground">名称</Label>
                  <Input
                    value={rule.name}
                    onChange={(event) => updateRule(rule.id, { name: event.target.value })}
                    className="h-8 w-full"
                  />
                </div>

                <div className="grid min-w-0 flex-1 basis-32 gap-1">
                  <Label className="text-xs text-muted-foreground">类型</Label>
                  <Select value={rule.category} onValueChange={(value) => updateRuleCategory(rule.id, value)}>
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid min-w-0 flex-1 basis-36 gap-1">
                  <Label className="text-xs text-muted-foreground">条件</Label>
                  {rule.category === 'material_thickness' && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={rule.thicknessMm ?? ''}
                        onChange={(event) => updateRule(rule.id, { thicknessMm: Number(event.target.value) })}
                        className="h-8 w-full"
                      />
                      <span className="text-sm text-muted-foreground">mm</span>
                    </div>
                  )}
                  {rule.category === 'finish' && (
                    <Select
                      value={rule.finishType ?? 'mixed_oil'}
                      onValueChange={(value) => {
                        if (isFinishType(value)) updateRule(rule.id, { finishType: value });
                      }}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {finishOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {rule.category === 'veneer' && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={rule.veneerThicknessMm ?? ''}
                        onChange={(event) => updateRule(rule.id, { veneerThicknessMm: Number(event.target.value) })}
                        className="h-8 w-full"
                      />
                      <span className="whitespace-nowrap text-sm text-muted-foreground">mm 木皮</span>
                    </div>
                  )}
                  {rule.category === 'forming' && (
                    <Select
                      value={rule.formingMethod ?? 'pressing'}
                      onValueChange={(value) => {
                        if (isFormingMethod(value)) updateRule(rule.id, { formingMethod: value });
                      }}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formingOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {(rule.category === 'process' || rule.category === 'handleless') && (
                    <div className="flex h-8 items-center text-sm text-muted-foreground">{formatRuleMeta(rule)}</div>
                  )}
                </div>

                <div className="grid min-w-0 flex-1 basis-28 gap-1">
                  <Label className="text-xs text-muted-foreground">单位</Label>
                  <Select
                    value={rule.unit}
                    onValueChange={(value) => {
                      if (isRuleUnit(value)) updateRule(rule.id, { unit: value });
                    }}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid min-w-0 flex-1 basis-24 gap-1">
                  <Label className="text-xs text-muted-foreground">单价</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rule.unitPrice}
                    onChange={(event) => updateRule(rule.id, { unitPrice: Number(event.target.value) })}
                    className="h-8 w-full"
                  />
                </div>

                <div className="grid min-w-0 flex-[1.4] basis-48 gap-1">
                  <Label className="text-xs text-muted-foreground">备注</Label>
                  <Textarea
                    value={rule.note ?? ''}
                    onChange={(event) => updateRule(rule.id, { note: event.target.value })}
                    className="h-8 min-h-8 w-full resize-none py-1.5"
                  />
                </div>

                <div className="grid basis-12 justify-items-center gap-1">
                  <Label className="text-xs text-muted-foreground">启用</Label>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
                    aria-label="启用单价规则"
                  />
                </div>

                <div className="grid basis-9 justify-items-center gap-1">
                  <span className="h-4" />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRule(rule.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <Label className="text-sm font-medium">成型工艺说明</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            压制用于上下薄板加中间抗变形铺料的结构；直裁用于预制板厚度一致、直接大板裁切的结构。两类规则可分别设价。
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <span className="text-sm text-muted-foreground">
            {hasUnsavedChanges ? '有未保存的单价改动' : `已配置 ${rules.length} 条单价规则`}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setRules(defaultRules)}>
              恢复默认项
            </Button>
            <Button type="button" onClick={saveSettings} disabled={isSaving || !hasUnsavedChanges}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存单价设置
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
