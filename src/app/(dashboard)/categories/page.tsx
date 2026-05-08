import { getCategories } from "@/app/actions/categories";
import { CategoriesContent } from "./categories-content";

export default async function CategoriesPage() {
  const categories = await getCategories();
  return <CategoriesContent initialCategories={categories} />;
}
