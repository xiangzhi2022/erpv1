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
