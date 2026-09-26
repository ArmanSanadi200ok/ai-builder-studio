import { db } from "@/db";
import { projectFiles } from "@/db/schema/projects";
import { eq } from "drizzle-orm";
import path from "path-browserify";

export type ValidationResult = {
  repaired: boolean;
  missingImports: Array<{ importingFile: string, importPath: string, expectedPath: string }>;
};

export async function validateAndRepairProject(versionId: string): Promise<ValidationResult> {
  const files = await db.query.projectFiles.findMany({
    where: eq(projectFiles.versionId, versionId)
  });

  if (!files || files.length === 0) return { repaired: false, missingImports: [] };

  let repaired = false;
  const missingImports: Array<{ importingFile: string, importPath: string, expectedPath: string }> = [];

  const getFile = (p: string) => {
    // normalized match
    const normalized = p.startsWith('/') ? p.slice(1) : p;
    return files.find(f => {
      const fn = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      return fn === normalized;
    });
  };
  const updateFileContent = async (id: string, newContent: string) => {
    await db.update(projectFiles).set({ content: newContent }).where(eq(projectFiles.id, id));
    repaired = true;
  };
  const createFile = async (path: string, content: string) => {
    await db.insert(projectFiles).values({ versionId, path, content });
    files.push({ id: crypto.randomUUID(), versionId, path, content, createdAt: new Date() });
    repaired = true;
  };

  const packageJsonFile = getFile("package.json");
  const viteConfigFile = getFile("vite.config.ts") || getFile("vite.config.js");
  const tsConfigFile = getFile("tsconfig.json");

  // A. PACKAGE DEPENDENCY CONSISTENCY & B. VITE REACT VALIDATION
  if (packageJsonFile && viteConfigFile) {
    try {
      const pkg = JSON.parse(packageJsonFile.content);
      const viteContent = viteConfigFile.content;
      
      const usesReactPlugin = viteContent.includes("@vitejs/plugin-react");
      
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const hasReactPluginDep = !!allDeps["@vitejs/plugin-react"];

      if (usesReactPlugin && !hasReactPluginDep) {
        // Add dependency
        pkg.devDependencies = pkg.devDependencies || {};
        pkg.devDependencies["@vitejs/plugin-react"] = "^4.2.1"; // Default version
        await updateFileContent(packageJsonFile.id, JSON.stringify(pkg, null, 2));
      }
    } catch (e) {
      console.error("Failed to parse package.json during validation", e);
    }
  }

  // C. REQUIRED FILE VALIDATION (tsconfig.node.json)
  if (tsConfigFile) {
    try {
      const tsconfigContent = tsConfigFile.content;
      if (tsconfigContent.includes("tsconfig.node.json")) {
        const tsconfigNodeFile = getFile("tsconfig.node.json");
        if (!tsconfigNodeFile) {
          // Create the missing tsconfig.node.json
          const defaultNodeTsConfig = `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}`;
          await createFile("tsconfig.node.json", defaultNodeTsConfig);
        }
      }
    } catch (e) {
      console.error("Failed to validate tsconfig during validation", e);
    }
  }

  // D. LOCAL IMPORT VALIDATION
  for (const file of files) {
    if (!file.path.match(/\.(ts|tsx|js|jsx|css)$/)) continue;

    const imports: { match: string, importPath: string, startIndex: number, length: number }[] = [];
    const content = file.content;

    if (file.path.endsWith('.css')) {
      const urlRegex = /url\(['"]?(\.[^'"\)]+)['"]?\)/g;
      let match;
      while ((match = urlRegex.exec(content)) !== null) {
        imports.push({ match: match[0], importPath: match[1], startIndex: match.index, length: match[0].length });
      }
    } else {
      const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"](\.[^'"]+)['"]/g;
      const requireRegex = /require\(['"](\.[^'"]+)['"]\)/g;
      const dynamicImportRegex = /import\(['"](\.[^'"]+)['"]\)/g;
      const sideEffectImportRegex = /import\s+['"](\.[^'"]+)['"]/g;

      for (const regex of [importRegex, requireRegex, dynamicImportRegex, sideEffectImportRegex]) {
        let match;
        while ((match = regex.exec(content)) !== null) {
          imports.push({ match: match[0], importPath: match[1], startIndex: match.index, length: match[0].length });
        }
      }
    }

    let fileContentUpdated = content;
    let fileChanged = false;

    // Process from end to start to not mess up indices if we do replacements
    // Filter duplicates by index
    const uniqueImports = [];
    const seenIndices = new Set();
    for (const imp of imports) {
      if (!seenIndices.has(imp.startIndex)) {
        seenIndices.add(imp.startIndex);
        uniqueImports.push(imp);
      }
    }
    
    uniqueImports.sort((a, b) => b.startIndex - a.startIndex);

    for (const imp of uniqueImports) {
      // Resolve path
      const dir = path.posix.dirname(file.path.startsWith('/') ? file.path : '/' + file.path);
      let expectedPath = path.posix.join(dir, imp.importPath);
      if (expectedPath.startsWith('/')) expectedPath = expectedPath.slice(1);

      // Does it exist? Check with extensions if not specified
      const checkExists = (p: string) => {
        if (getFile(p)) return p;
        const exts = ['.ts', '.tsx', '.js', '.jsx', '.css', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
        for (const ext of exts) {
          if (getFile(p + ext)) return p + ext;
        }
        return null;
      };

      const foundPath = checkExists(expectedPath);
      if (!foundPath) {
        // Not found! Try to repair intelligently
        let repairedImport = false;
        
        if (expectedPath.endsWith('.css')) {
          const cssFiles = files.filter(f => f.path.endsWith('.css'));
          if (cssFiles.length > 0) {
            // E.g. expected: src/index.css, found: src/styles.css
            const replacementFile = cssFiles[0].path;
            const newRelative = path.posix.relative(dir, replacementFile.startsWith('/') ? replacementFile : '/' + replacementFile);
            const formattedRelative = newRelative.startsWith('.') ? newRelative : './' + newRelative;
            
            // replace in content
            const newMatchStr = imp.match.replace(imp.importPath, formattedRelative);
            fileContentUpdated = fileContentUpdated.substring(0, imp.startIndex) + newMatchStr + fileContentUpdated.substring(imp.startIndex + imp.length);
            fileChanged = true;
            repairedImport = true;
          }
        }
        
        if (!repairedImport) {
          missingImports.push({
            importingFile: file.path,
            importPath: imp.importPath,
            expectedPath
          });
        }
      }
    }

    if (fileChanged) {
      await updateFileContent(file.id, fileContentUpdated);
    }
  }

  return { repaired, missingImports };
}
