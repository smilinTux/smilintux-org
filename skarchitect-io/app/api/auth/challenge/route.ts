import { NextResponse } from "next/server";
import { createChallenge } from "@/lib/auth/challenge";

export async function POST() {
  const challenge = await createChallenge();
  return NextResponse.json(challenge);
}
