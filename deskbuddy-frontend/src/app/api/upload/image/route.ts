// src/app/api/upload/image/route.ts
// Proxies base64 image uploads to Cloudinary, keeping API credentials
// server-side and out of the browser.
//
// Required env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// If not set, returns 503 and the caller should fall back to base64 localStorage.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { extractUserFromRequest } from "@/lib/jwt-server";

const MAX_DATA_URL_BYTES = 10 * 1024 * 1024; // 10 MB covers ~7.5 MB raw JPEG

// Simple in-process rate limiter: 10 uploads per user per hour
const _uploadCounts = new Map<string, { count: number; resetAt: number }>();
const UPLOAD_LIMIT  = 10;
const UPLOAD_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkUploadRateLimit(userId: string): boolean {
  const now    = Date.now();
  const bucket = _uploadCounts.get(userId);
  if (!bucket || now > bucket.resetAt) {
    _uploadCounts.set(userId, { count: 1, resetAt: now + UPLOAD_WINDOW });
    return true;
  }
  if (bucket.count >= UPLOAD_LIMIT) return false;
  bucket.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // Auth required in production
  const payload = extractUserFromRequest(req);
  if (process.env.JWT_SECRET && !payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 uploads per user per hour
  const userId = payload?.sub ?? "anon";
  if (!checkUploadRateLimit(userId)) {
    return NextResponse.json(
      { error: "Upload limit reached (10 per hour)" },
      { status: 429 }
    );
  }

  let body: { data?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dataUrl = body.data ?? "";
  if (!dataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Expected a data:image/* URL" }, { status: 400 });
  }
  if (dataUrl.length > MAX_DATA_URL_BYTES) {
    return NextResponse.json({ error: "Image too large (10 MB limit)" }, { status: 413 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 503 });
  }

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder    = `deskbuddy/${userId}`;
    // Cloudinary signed-upload signature: alphabetical params + secret
    const toSign    = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHash("sha1").update(toSign).digest("hex");

    const form = new FormData();
    form.append("file",      dataUrl);
    form.append("api_key",   apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("folder",    folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: form }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Cloudinary upload failed:", err);
      return NextResponse.json({ error: "Upload failed" }, { status: 502 });
    }

    const data = await res.json() as { secure_url: string; public_id: string };
    return NextResponse.json({ url: data.secure_url, public_id: data.public_id });

  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
