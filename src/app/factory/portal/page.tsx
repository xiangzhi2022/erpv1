import { redirect } from "next/navigation";

/**
 * Lightweight route alias: /factory/portal → /factory
 * Preserves the existing factory dashboard at /factory without duplication.
 */
export default function FactoryPortalPage() {
  redirect("/factory");
}
