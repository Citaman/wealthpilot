// Icon mapping utility - maps string icon names to Lucide React components
import {
  Wallet,
  Home,
  Utensils,
  Car,
  ShoppingBag,
  FileText,
  Heart,
  Film,
  Users,
  Briefcase,
  ArrowRightLeft,
  Landmark,
  HelpCircle,
  Baby,
  Shield,
  Plane,
  type LucideIcon,
} from "lucide-react";

// Map icon string names to Lucide components
export const iconMap: Record<string, LucideIcon> = {
  wallet: Wallet,
  home: Home,
  utensils: Utensils,
  car: Car,
  "shopping-bag": ShoppingBag,
  "file-text": FileText,
  heart: Heart,
  film: Film,
  users: Users,
  briefcase: Briefcase,
  "arrow-right-left": ArrowRightLeft,
  landmark: Landmark,
  baby: Baby,
  shield: Shield,
  plane: Plane,
};

// Get Lucide icon component from string name
export function getIconComponent(iconName: string | undefined): LucideIcon {
  if (!iconName) return HelpCircle;
  return iconMap[iconName] || HelpCircle;
}
