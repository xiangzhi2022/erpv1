import { NextResponse } from "next/server";
import { getCategories, createCategory } from "@/app/actions/categories";

// GET /api/categories - 查询所有分类
export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({ success: true, data: categories });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "查询分类失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/categories - 创建分类
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color, description } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "分类名称不能为空" },
        { status: 400 }
      );
    }
    const category = await createCategory({
      name: name.trim(),
      color: color ?? "#6366f1",
      description: description ?? null,
    });
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "创建分类失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
