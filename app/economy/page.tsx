import { redirect } from "next/navigation";

// Economy was merged into the Markets page. Keep this route as a redirect so
// existing links and bookmarks still land in the right place.
export default function EconomyPage() {
  redirect("/markets#economy");
}
