// Maps each learning track to a lucide line-icon, matching the site's icon
// style (no emoji). Keeps the visual language consistent across the app.
import {
  BookOpen,
  BarChart3,
  DollarSign,
  TrendingUp,
  Table2,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export const TRACK_ICON: Record<string, LucideIcon> = {
  dictionary: BookOpen,
  accounting: BarChart3,
  valuation: DollarSign,
  economy: TrendingUp,
  excel: Table2,
  technicals: Landmark,
};
