"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  workshopFormSchema,
  WorkshopFormValues,
  Workshop,
} from "../schemas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface FactoryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshop?: Workshop | null;
  onSubmit: (values: WorkshopFormValues) => Promise<void>;
}

const formDefaults: WorkshopFormValues = {
  factory_code: "",
  name: "",
  location: "",
  manager: "",
  capacity: 0,
  description: "",
};

export function FactoryFormModal({
  open,
  onOpenChange,
  workshop,
  onSubmit,
}: FactoryFormModalProps) {
  const isEditing = !!workshop;

  const resolver = zodResolver(workshopFormSchema) as Resolver<WorkshopFormValues>;

  const form = useForm<WorkshopFormValues>({
    resolver,
    defaultValues: workshop
      ? {
          factory_code: workshop.factory_code,
          name: workshop.name,
          location: workshop.location || "",
          manager: workshop.manager || "",
          capacity: workshop.capacity,
          description: workshop.description || "",
        }
      : formDefaults,
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      form.reset(
        workshop
          ? {
              factory_code: workshop.factory_code,
              name: workshop.name,
              location: workshop.location || "",
              manager: workshop.manager || "",
              capacity: workshop.capacity,
              description: workshop.description || "",
            }
          : formDefaults
      );
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (values: WorkshopFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "编辑车间信息" : "新增车间"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="factory_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      车间编号 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如 WH-A01"
                        {...field}
                        disabled={isEditing}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      车间名称 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="如 板式车间" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>位置</FormLabel>
                    <FormControl>
                      <Input placeholder="如 A栋1楼" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>负责人</FormLabel>
                    <FormControl>
                      <Input placeholder="负责人姓名" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>日产能</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      min={0}
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="车间描述信息..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isEditing ? "保存修改" : "创建车间"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
