import { getTaskStats } from "@/app/actions/tasks";
import { getCategories } from "@/app/actions/categories";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const [stats, categories] = await Promise.all([
    getTaskStats(),
    getCategories(),
  ]);

  return <DashboardContent stats={stats} categoryCount={categories.length} />;
}
