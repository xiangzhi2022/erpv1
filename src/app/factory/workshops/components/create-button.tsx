"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface CreateFactoryButtonProps {
  onClick: () => void;
}

export function CreateFactoryButton({ onClick }: CreateFactoryButtonProps) {
  return (
    <Button onClick={onClick}>
      <Plus className="h-4 w-4 mr-2" />
      新增车间
    </Button>
  );
}
