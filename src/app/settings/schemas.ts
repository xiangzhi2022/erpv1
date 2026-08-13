import { z } from 'zod/v4';

// 个人资料表单 Schema
export const profileSchema = z.object({
  nickname: z
    .string()
    .min(1, '姓名不能为空')
    .max(50, '姓名不能超过50个字符'),
  phone: z
    .string()
    .min(1, '手机号不能为空')
    .regex(/^1\d{10}$/, '请输入正确的手机号格式'),
  bio: z
    .string()
    .max(200, '个人简介不能超过200个字符'),
  avatarUrl: z
    .string(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

// 修改密码 Schema
export const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, '请输入当前密码'),
    newPassword: z
      .string()
      .min(6, '新密码至少6位')
      .max(50, '密码不能超过50个字符')
      .regex(/[a-zA-Z]/, '密码必须包含字母')
      .regex(/\d/, '密码必须包含数字'),
    confirmPassword: z
      .string()
      .min(1, '请确认新密码'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '新密码不能与当前密码相同',
    path: ['newPassword'],
  });

export type PasswordFormValues = z.infer<typeof passwordSchema>;

// 外观偏好 Schema
export const appearanceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system'], {
    message: '请选择有效的主题',
  }),
});

export type AppearanceFormValues = z.infer<typeof appearanceSchema>;

// 公司信息 Schema
export const companySchema = z.object({
  prefix: z
    .string()
    .min(1, '前缀不能为空')
    .max(10, '前缀不能超过10个字符')
    .regex(/^[A-Z]+$/, '前缀只能包含大写英文字母'),
  companyName: z
    .string()
    .min(1, '公司名称不能为空')
    .max(100, '公司名称不能超过100个字符'),
  companyPhone: z
    .string(),
  companyAddress: z
    .string(),
});

export type CompanyFormValues = z.infer<typeof companySchema>;

export const unitPriceRuleCategorySchema = z.enum([
  'material_thickness',
  'process',
  'finish',
  'veneer',
  'handleless',
  'forming',
]);

export const unitPriceRuleUnitSchema = z.enum(['sqm', 'm', 'piece', 'set']);
export const finishTypeSchema = z.enum(['mixed_oil', 'veneer']);
export const formingMethodSchema = z.enum(['pressing', 'direct_cut']);

export const unitPriceRuleSchema = z
  .object({
    id: z.string().min(1),
    category: unitPriceRuleCategorySchema,
    name: z.string().min(1, '单价名称不能为空').max(80, '单价名称不能超过80个字符'),
    thicknessMm: z.coerce.number().positive('材料厚度必须大于0').optional(),
    veneerThicknessMm: z.coerce.number().positive('木皮厚度必须大于0').optional(),
    finishType: finishTypeSchema.optional(),
    formingMethod: formingMethodSchema.optional(),
    unit: unitPriceRuleUnitSchema,
    unitPrice: z.coerce.number().min(0, '单价不能为负数'),
    note: z.string().max(200, '备注不能超过200个字符').optional(),
    enabled: z.boolean(),
  })
  .superRefine((rule, ctx) => {
    if (rule.category === 'material_thickness' && rule.thicknessMm === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: '材料厚度单价必须填写厚度',
        path: ['thicknessMm'],
      });
    }

    if (rule.category === 'veneer' && rule.veneerThicknessMm === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: '贴皮单价必须填写木皮厚度',
        path: ['veneerThicknessMm'],
      });
    }

    if ((rule.category === 'finish' || rule.category === 'veneer') && rule.finishType === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: '表面工艺必须选择混油或贴皮',
        path: ['finishType'],
      });
    }

    if (rule.category === 'forming' && rule.formingMethod === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: '成型工艺必须选择压制或直裁',
        path: ['formingMethod'],
      });
    }
  });

export const unitPriceSettingsSchema = z.object({
  rules: z.array(unitPriceRuleSchema).max(200, '单价规则不能超过200条'),
});

export type UnitPriceRuleCategory = z.infer<typeof unitPriceRuleCategorySchema>;
export type UnitPriceRuleUnit = z.infer<typeof unitPriceRuleUnitSchema>;
export type FinishType = z.infer<typeof finishTypeSchema>;
export type FormingMethod = z.infer<typeof formingMethodSchema>;
export type UnitPriceRule = z.infer<typeof unitPriceRuleSchema>;
export type UnitPriceSettings = z.infer<typeof unitPriceSettingsSchema>;
