'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, type ProfileFormValues } from '../schemas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  phone: string;
  nickname: string;
  role: string;
  tenantType: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
}

export function ProfileForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initialValues, setInitialValues] = useState<ProfileFormValues | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nickname: '',
      phone: '',
      bio: '',
      avatarUrl: '',
    },
  });

  // 监听表单变化
  const watchedValues = form.watch();

  useEffect(() => {
    if (!initialValues) return;
    const changed =
      watchedValues.nickname !== initialValues.nickname ||
      watchedValues.phone !== initialValues.phone ||
      watchedValues.bio !== initialValues.bio;
    setHasUnsavedChanges(changed);
  }, [watchedValues, initialValues]);

  // 加载用户资料
  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/profile');
      const data = await response.json();
      if (data.success && data.profile) {
        const profile: UserProfile = data.profile;
        const formValues = {
          nickname: profile.nickname || '',
          phone: profile.phone || '',
          bio: profile.bio || '',
          avatarUrl: profile.avatarUrl || '',
        };
        form.reset(formValues);
        setInitialValues(formValues);
        setAvatarUrl(profile.avatarUrl || '');
      }
    } catch (error) {
      console.error('加载用户资料失败:', error);
      toast.error('加载用户资料失败');
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // 头像上传处理
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 前端验证
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('仅支持 JPG/PNG 格式的图片');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过2MB');
      return;
    }

    // 压缩图片
    setIsUploadingAvatar(true);
    setUploadProgress(10);

    try {
      // 客户端压缩
      const compressedFile = await compressImage(file, 800, 0.85);
      setUploadProgress(40);

      const formData = new FormData();
      formData.append('avatar', compressedFile);

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/settings/avatar', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      const data = await response.json();
      if (data.success) {
        setUploadProgress(100);
        setAvatarUrl(data.avatarUrl);
        form.setValue('avatarUrl', data.avatarUrl);
        toast.success('头像已更新');
      } else {
        toast.error(data.error || '头像上传失败');
      }
    } catch (error) {
      console.error('头像上传失败:', error);
      toast.error('头像上传失败');
    } finally {
      setIsUploadingAvatar(false);
      setTimeout(() => setUploadProgress(0), 1000);
      // 重置 file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 图片压缩函数
  const compressImage = (
    file: File,
    maxWidth: number,
    quality: number
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建画布'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('压缩失败'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            file.type,
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 保存个人资料
  const onSubmit = async (values: ProfileFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('个人资料已更新');
        setInitialValues(values);
        setHasUnsavedChanges(false);
      } else {
        toast.error(data.error || '更新失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
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
      <CardHeader>
        <CardTitle>个人资料</CardTitle>
        <CardDescription>管理您的个人信息和头像</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 头像上传区域 */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} alt="用户头像" />
              <AvatarFallback className="text-lg">
                {getInitials(form.getValues('nickname'))}
              </AvatarFallback>
            </Avatar>
            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    上传中 {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    更换头像
                  </>
                )}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAvatarUrl('');
                    form.setValue('avatarUrl', '');
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  移除
                </Button>
              )}
            </div>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              支持 JPG/PNG 格式，最大 2MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
        </div>

        <Separator />

        {/* 资料表单 */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入姓名" {...field} />
                    </FormControl>
                    <FormDescription>您的显示名称</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>手机号</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入手机号" {...field} />
                    </FormControl>
                    <FormDescription>用于登录和联系方式</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>个人简介</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="简单介绍一下自己..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    最多200个字符，将展示在您的个人主页
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex justify-between items-center">
              {hasUnsavedChanges && (
                <span className="text-sm text-amber-600">您有未保存的更改</span>
              )}
              <div className="ml-auto flex gap-2">
                {hasUnsavedChanges && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (initialValues) {
                        form.reset(initialValues);
                        setHasUnsavedChanges(false);
                      }
                    }}
                  >
                    撤销更改
                  </Button>
                )}
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      保存中...
                    </>
                  ) : (
                    '保存更改'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
