import { db } from '@/db';
import { projects } from '@/db/schema/projects';
import { eq } from 'drizzle-orm';

/**
 * Executes a lightweight HTTP GET against the project's preview URL to verify the app starts.
 * Returns true if a 200 response is received within the timeout, otherwise false.
 *
 * IMPORTANT: This is a smoke test ONLY. It verifies that the generated application
 * starts and responds to HTTP requests. It does NOT perform:
 * - DOM inspection
 * - Browser interaction testing (clicks, forms, navigation)
 * - Responsive layout verification
 * - JavaScript console error checking
 * - localStorage/state persistence testing
 */
export async function runRuntimeTest(projectId: string, timeoutMs = 30000): Promise<boolean> {
  // Retrieve preview URL from the project record
  const proj = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { previewUrl: true },
  });
  if (!proj?.previewUrl) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(proj.previewUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}
