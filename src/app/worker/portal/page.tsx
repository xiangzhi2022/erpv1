import { redirect } from "next/navigation";

/**
 * Lightweight route alias: /worker/portal → /worker
 * Preserves the existing worker dashboard at /worker without duplication.
 */
export default function WorkerPortalPage() {
  redirect("/worker");
}
