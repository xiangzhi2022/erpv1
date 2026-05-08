'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface RoleItem {
  id: number;
  role_name: string;
  dept: string;
  description?: string;
  user_count?: number;
}

export function RolesForm() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await fetch('/api/settings/roles');
        const data = await response.json();
        if (data.success && data.roles) {
          setRoles(data.roles);
        }
      } catch (error) {
        console.error('加载角色列表失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadRoles();
  }, []);

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
        <CardTitle>角色权限</CardTitle>
        <CardDescription>管理用户角色和权限配置</CardDescription>
      </CardHeader>
      <CardContent>
        {roles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">暂无角色数据</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <Card key={role.id} className="p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{role.role_name}</h4>
                  <Badge variant="secondary" className="text-xs">{role.dept}</Badge>
                </div>
                {role.description && (
                  <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
