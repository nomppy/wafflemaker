import { getRequestContext } from "@cloudflare/next-on-pages";

function getAudioBucket(): R2Bucket {
  return getRequestContext().env.AUDIO_BUCKET;
}

export async function saveAudio(key: string, data: ArrayBuffer | ReadableStream | Uint8Array) {
  const bucket = getAudioBucket();
  await bucket.put(key, data);
}

export async function getAudio(key: string): Promise<R2ObjectBody | null> {
  const bucket = getAudioBucket();
  return bucket.get(key);
}

export async function deleteAudio(key: string) {
  const bucket = getAudioBucket();
  await bucket.delete(key);
}
