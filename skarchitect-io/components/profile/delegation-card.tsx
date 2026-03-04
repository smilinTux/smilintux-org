"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DelegationCardProps {
  delegation: {
    delegation_id: string;
    delegate_did: string;
    category: string | null;
    created_at: string;
  };
  onRevoke?: (id: string) => void;
}

export function DelegationCard({ delegation, onRevoke }: DelegationCardProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-400">
          Delegated to
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="break-all font-mono text-sm text-zinc-300">
          {delegation.delegate_did}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <Badge variant="outline">
            {delegation.category || "All categories"}
          </Badge>
          {onRevoke && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-400 hover:text-red-300"
              onClick={() => onRevoke(delegation.delegation_id)}
            >
              Revoke
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
