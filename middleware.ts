// middleware.ts — auth disabled for preview
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = { matcher: [] };
