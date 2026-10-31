import { NextResponse, type NextRequest } from "next/server";
import { localRequestAllowed } from "@/lib/local-request";
export function proxy(request: NextRequest) {
  if (!localRequestAllowed(request.headers, request.url))
    return new NextResponse(
      "This private dashboard accepts local, same-origin requests only.",
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  return NextResponse.next();
}
export const config = { matcher: "/:path*" };
