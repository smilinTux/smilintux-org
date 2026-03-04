import { Badge } from "@/components/ui/badge";

const categoryColors: Record<string, string> = {
  infrastructure: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  policy: "bg-purple-600/20 text-purple-400 border-purple-600/30",
  technology: "bg-cyan-600/20 text-cyan-400 border-cyan-600/30",
  culture: "bg-pink-600/20 text-pink-400 border-pink-600/30",
  challenge: "bg-amber-600/20 text-amber-400 border-amber-600/30",
  solution: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
  partnership: "bg-indigo-600/20 text-indigo-400 border-indigo-600/30",
};

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge
      variant="outline"
      className={categoryColors[category] || "bg-zinc-600/20 text-zinc-400"}
    >
      {category}
    </Badge>
  );
}
