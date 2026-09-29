import { ProjectIntent } from '@/lib/intentEngine';
import { db } from '@/db';
import { projectVersions, projectFiles } from '@/db/schema/projects';
import { eq, and, desc } from 'drizzle-orm';
import pathBrowserify from 'path-browserify';

/**
 * Perform a deterministic, intent-aware review of the generated project.
 * Returns true if the project passes all quality gates, otherwise false.
 * The function also returns an array of human-readable issue strings for logging.
 *
 * IMPORTANT: This reviewer does NOT perform browser automation, UI interaction
 * testing, responsive layout verification, or JavaScript runtime checks.
 * It performs static file/config analysis only.
 */
export async function finalReview(
  projectId: string,
  intent: ProjectIntent
): Promise<{ passed: boolean; issues: string[] }> {
  const issues: string[] = [];

  // 1. Load all files for the latest version.
  const version = await db.query.projectVersions.findFirst({
    where: eq(projectVersions.projectId, projectId),
    orderBy: [desc(projectVersions.versionNumber)],
  });
  if (!version) {
    issues.push('CRITICAL: No project version found.');
    return { passed: false, issues };
  }
  const files = await db.query.projectFiles.findMany({
    where: eq(projectFiles.versionId, version.id),
  });

  // Helpers
  const getFile = (p: string) => files.find(f => f.path === p);
  const filePaths = new Set(files.map(f => f.path));

  const fileExists = (p: string): boolean => {
    const normalized = p.startsWith('/') ? p.slice(1) : p;
    if (filePaths.has(normalized)) return true;
    // Check with common extensions
    const exts = ['.ts', '.tsx', '.js', '.jsx', '.css', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
    for (const ext of exts) {
      if (filePaths.has(normalized + ext)) return true;
    }
    return false;
  };

  // 2. Intent compliance — ensure required project structure exists.
  if (intent.applicationType === 'WEB_APP') {
    if (!getFile('package.json')) issues.push('CRITICAL: Missing package.json for WEB_APP.');
    if (!getFile('index.html')) issues.push('CRITICAL: Missing index.html for WEB_APP.');
    if (!getFile('vite.config.ts') && !getFile('vite.config.js')) {
      issues.push('WARNING: Missing Vite config for WEB_APP.');
    }
  }
  if (intent.applicationType === 'WHATSAPP_BOT') {
    if (!getFile('package.json')) issues.push('CRITICAL: Missing package.json for WhatsApp bot.');
    if (!getFile('src/index.ts') && !getFile('src/index.js')) {
      issues.push('CRITICAL: Missing entry point for WhatsApp bot.');
    }
  }

  // 3. Broken local imports — resolve each relative import against actual file list.
  for (const file of files) {
    if (!file.path.match(/\.(ts|tsx|js|jsx)$/)) continue;

    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/g;
    const sideEffectImportRegex = /import\s+['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/g;

    const seenPaths = new Set<string>();

    for (const regex of [importRegex, sideEffectImportRegex]) {
      let match;
      while ((match = regex.exec(file.content)) !== null) {
        const importPath = match[1];
        if (seenPaths.has(importPath)) continue;
        seenPaths.add(importPath);

        // Resolve relative to the importing file's directory
        const dir = pathBrowserify.posix.dirname(
          file.path.startsWith('/') ? file.path : '/' + file.path
        );
        let resolved = pathBrowserify.posix.join(dir, importPath);
        if (resolved.startsWith('/')) resolved = resolved.slice(1);

        if (!fileExists(resolved)) {
          issues.push(
            `ERROR: Broken import in ${file.path}: '${importPath}' resolves to '${resolved}' which does not exist.`
          );
        }
      }
    }
  }

  // 4. Dependency / configuration consistency.
  const pkgFile = getFile('package.json');
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);

      // Validate build script exists for non-static projects
      if (!pkg.scripts?.build && !pkg.scripts?.dev) {
        issues.push('WARNING: package.json has no build or dev script.');
      }

      // If vite config references React plugin, ensure dependency exists
      const viteFile = getFile('vite.config.ts') || getFile('vite.config.js');
      if (viteFile && viteFile.content.includes('@vitejs/plugin-react')) {
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (!allDeps['@vitejs/plugin-react']) {
          issues.push('ERROR: vite config uses @vitejs/plugin-react but dependency is missing from package.json.');
        }
      }

      // Verify React is listed if tsx/jsx files exist
      const hasJsx = files.some(f => f.path.match(/\.(tsx|jsx)$/));
      if (hasJsx) {
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (!allDeps['react']) {
          issues.push('ERROR: Project has JSX/TSX files but react is not listed in dependencies.');
        }
      }
    } catch {
      issues.push('CRITICAL: package.json is not valid JSON.');
    }
  }

  // 5. Entry point validation for React projects.
  if (intent.applicationType === 'WEB_APP') {
    const entry = getFile('src/main.tsx') || getFile('src/main.jsx') || getFile('src/main.ts') || getFile('src/main.js');
    if (entry && !entry.content.includes('react') && !entry.content.includes('React')) {
      issues.push('WARNING: React project entry file does not reference React.');
    }
  }

  // 6. Hard-coded credentials detection.
  const credentialPatterns = [
    /["'](AKIA[A-Z0-9]{16,})["']/,           // AWS Access Key
    /["'](AIza[a-zA-Z0-9_-]{35,})["']/,       // Google API Key
    /["'](sk_live_[a-zA-Z0-9]{24,})["']/,     // Stripe Live Key
    /["'](sk_test_[a-zA-Z0-9]{24,})["']/,     // Stripe Test Key
  ];
  for (const file of files) {
    for (const pattern of credentialPatterns) {
      if (pattern.test(file.content)) {
        issues.push(`CRITICAL: Hard-coded credentials detected in ${file.path}.`);
        break;
      }
    }
  }

  // 7. Placeholder text detection.
  const placeholderPatterns = ['lorem ipsum', 'YOUR_API_KEY_HERE', 'TODO: implement', 'FIXME: placeholder'];
  for (const file of files) {
    const lower = file.content.toLowerCase();
    for (const pattern of placeholderPatterns) {
      if (lower.includes(pattern.toLowerCase())) {
        issues.push(`WARNING: Placeholder text '${pattern}' detected in ${file.path}.`);
        break;
      }
    }
  }

  // 8. Regression check — compare with previous version.
  const previousVersion = await db.query.projectVersions.findFirst({
    where: and(
      eq(projectVersions.projectId, projectId),
      eq(projectVersions.versionNumber, version.versionNumber - 1)
    ),
    columns: { id: true },
  });
  if (previousVersion) {
    const prevFiles = await db.query.projectFiles.findMany({
      where: eq(projectFiles.versionId, previousVersion.id),
    });
    const prevPaths = new Set(prevFiles.map(f => f.path));
    const currentPaths = new Set(files.map(f => f.path));
    for (const p of prevPaths) {
      if (!currentPaths.has(p)) {
        issues.push(`WARNING: File ${p} was removed during regeneration (possible regression).`);
      }
    }
  }

  // Determine pass/fail: CRITICAL issues block, WARNINGs do not.
  const criticalIssues = issues.filter(i => i.startsWith('CRITICAL:') || i.startsWith('ERROR:'));
  return { passed: criticalIssues.length === 0, issues };
}
