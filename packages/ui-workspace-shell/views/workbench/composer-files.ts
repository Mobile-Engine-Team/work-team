export type InputAttachment = { filename: string; bytes: string };
export async function readAttachment(file: Blob, filename: string): Promise<InputAttachment> {
  if (file.size > 3 * 1024 * 1024) throw new Error("单个附件不能超过 3 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return { filename, bytes: btoa(chunks.join("")) };
}
