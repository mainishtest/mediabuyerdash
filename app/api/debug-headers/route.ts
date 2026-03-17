import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const h = await headers();
  const relevant: Record<string, string> = {};
  for (const key of ["host", "origin", "x-forwarded-host", "x-forwarded-proto", "referer"]) {
    const val = h.get(key);
    if (val) relevant[key] = val;
  }
  return NextResponse.json(relevant);
}
