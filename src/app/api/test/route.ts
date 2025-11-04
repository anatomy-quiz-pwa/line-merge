import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ message: "API 路由正常運作", timestamp: new Date().toISOString() });
}

export async function POST(req: Request) {
  return NextResponse.json({ message: "POST 方法正常運作", timestamp: new Date().toISOString() });
}

