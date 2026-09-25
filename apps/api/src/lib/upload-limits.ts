import { bodyLimit } from "hono/body-limit";

import { env } from "./env.js";

// Multipart boundaries and form fields add a small amount beyond the file size.
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

/**
 * Rejects oversized upload requests before multipart parsing buffers them.
 * The extra allowance accounts for multipart framing while the file itself is
 * still capped at env.MAX_UPLOAD_BYTES by the route handlers.
 */
export function limitUploadBody() {
  return bodyLimit({
    maxSize: env.MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES,
    onError: (c) => c.json({ error: "文件过大" }, 413),
  });
}
