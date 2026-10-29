import AdminConsole from "@/components/admin/AdminConsole";
import { allIssues } from "@/lib/newsletter-all";

export const metadata = { title: "Admin · HWS Investment Club" };

export default function AdminPage() {
  // Middleware restricts this route to the admin role.
  return <AdminConsole issues={allIssues()} />;
}
