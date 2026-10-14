import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { appendLocalUploadChunk, cancelLocalUpload, completeLocalUpload } from "@/lib/filesystem-storage";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

async function authorize(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return { response: NextResponse.json({ error: "Invalid origin" }, { status: 403 }) };
  }
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { session };
}

export async function PUT(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const authorization = await authorize(request);
  if (authorization.response) return authorization.response;
  const { uploadId } = await params;
  try {
    const progress = await appendLocalUploadChunk({
      uploadId,
      userId: authorization.session.userId,
      contentRange: request.headers.get("content-range"),
      contentLength: request.headers.get("content-length"),
      body: request.body,
    });
    return NextResponse.json(progress, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload chunk failed" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const authorization = await authorize(request);
  if (authorization.response) return authorization.response;
  const { uploadId } = await params;
  try {
    const asset = await completeLocalUpload(uploadId, authorization.session.userId);
    return NextResponse.json({ asset }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload could not be completed" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const authorization = await authorize(request);
  if (authorization.response) return authorization.response;
  const { uploadId } = await params;
  try {
    await cancelLocalUpload(uploadId, authorization.session.userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 204 });
    return NextResponse.json({ error: "Upload could not be cancelled" }, { status: 400 });
  }
}
