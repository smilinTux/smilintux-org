/**
 * Public tally endpoint — no auth required.
 * Redirects to the main tally endpoint.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const origin = req.nextUrl.origin;
  const response = await fetch(`${origin}/api/proposals/${id}/tally`);
  const tally = await response.json();
  return NextResponse.json(tally);
}
