import { NextResponse } from "next/server";
import {
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "@/app/actions/categories";

// GET /api/categories/[id] - 查询单个分类
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await getCategoryById(id);
    if (!category) {
      return NextResponse.json(
        { success: false, error: "分类不存在" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: category });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "查询分类失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/categories/[id] - 更新分类
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const category = await updateCategory(id, body);
    return NextResponse.json({ success: true, data: category });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "更新分类失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/categories/[id] - 删除分类
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "删除分类失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
