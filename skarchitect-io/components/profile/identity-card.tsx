import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IdentityCardProps {
  national: {
    did_key: string;
    entity_type: string;
    display_name?: string | null;
    created_at: string;
  };
}

export function IdentityCard({ national }: IdentityCardProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader>
        <CardTitle className="text-white">
          {national.display_name || "Anonymous National"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <span className="text-xs text-zinc-500">DID:key</span>
          <p className="break-all font-mono text-sm text-zinc-300">
            {national.did_key}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Type:</span>
          <Badge variant="outline">{national.entity_type}</Badge>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Joined:</span>
          <span className="ml-1 text-sm text-zinc-400">
            {new Date(national.created_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
