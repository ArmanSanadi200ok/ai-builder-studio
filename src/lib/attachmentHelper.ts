import { db } from '@/db';
import { projectAttachments } from '@/db/schema/projects';
import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Retrieve the full text content of an attachment.
 * For text based files (txt, md, pdf, etc.) the `extractedText` field is used if present.
 * If `extractedText` is missing, we attempt to read the file from storage using the `storageRef` path.
 */
export async function getAttachmentContent(attachmentId: string): Promise<string> {
  const attachment = await db.query.projectAttachments.findFirst({
    where: eq(projectAttachments.id, attachmentId),
  });
  if (!attachment) return '';

  // Prefer pre‑extracted text (e.g., OCR or PDF text extraction)
  if (attachment.extractedText) return attachment.extractedText;

  // Fallback: read the raw file from the storage bucket (local path for dev).
  // `storageRef` is assumed to be a relative path inside the server's storage root.
  const storageRoot = process.env.ATTACHMENT_STORAGE_ROOT || path.resolve('./storage');
  const filePath = path.resolve(storageRoot, attachment.storageRef);
  try {
    const data = await readFile(filePath, { encoding: 'utf8' });
    return data;
  } catch (e) {
    console.error('Failed to read attachment file', e);
    return '';
  }
}
