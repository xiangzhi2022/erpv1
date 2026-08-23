import { z } from 'zod';

const emailSchema = z.string().trim().email('邮箱格式不正确').max(254);
const phoneSchema = z.string().trim().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');
const accountSchema = z.union([emailSchema, phoneSchema]);
const passwordSchema = z.string().min(8, '密码至少 8 位').max(128, '密码过长');

export const loginSchema = z.object({
  account: accountSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  account: accountSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, '请输入管理员姓名').max(100),
  enterpriseName: z.string().trim().min(1, '请输入企业名称').max(200),
  enterpriseType: z.enum(['manufacturer', 'dealer', 'supplier']),
});

export const onboardingSchema = registerSchema.pick({
  displayName: true,
  enterpriseName: true,
  enterpriseType: true,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export const emailOtpSchema = z.object({
  email: emailSchema,
  token: z.string().trim().regex(/^\d{6}$/, '验证码必须是 6 位数字'),
});

export const phoneOtpSchema = z.object({
  phone: phoneSchema,
  token: z.string().trim().regex(/^\d{6}$/, '验证码必须是 6 位数字'),
});

export const oauthProviderSchema = z.enum(['github', 'google']);

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SupportedOAuthProvider = z.infer<typeof oauthProviderSchema>;
