import AdminConsole from "@/components/admin/AdminConsole";
import { ISSUES } from "@/data/newsletters";

export const metadata = { title: "Admin · HWS Investment Club" };

export default function AdminPage() {
  // Middleware restricts this route to the admin role.
  return <AdminConsole issues={ISSUES} />;
}
