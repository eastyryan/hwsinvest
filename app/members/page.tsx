import { getSession } from "@/lib/auth";
import Dashboard from "@/components/learn/Dashboard";
import { allIssues } from "@/lib/newsletter-all";

export const metadata = { title: "Dashboard · HWS Investment Club" };

export default async function MembersPage() {
  const role = await getSession(); // middleware already gated this route
  return <Dashboard admin={role === "admin"} latest={allIssues()[0] ?? null} />;
}
