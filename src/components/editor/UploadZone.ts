import { decodeFileFlipped } from "@/engine/decode";
import type { DecodedImage } from "@/engine/decode";

/**
 * A dropped or picked file, turned into something the engine can texture with —
 * or a clear error to toast. Decoding goes through an <img> so every format the
 * browser can show (WebP included) works the same way everywhere (see decode.ts).
 */
export async function fileToBitmap(file: File): Promise<DecodedImage> {
  return decodeFileFlipped(file);
}
