import { db } from "@/db";
import { projectFiles } from "@/db/schema/projects";
import { eq } from "drizzle-orm";

export async function validateAndRepairProject(versionId: string): Promise<boolean> {
  const files = await db.query.projectFiles.findMany({
    where: eq(projectFiles.versionId, versionId)
  });

  if (!files || files.length === 0) return true;

  let repaired = false;

  const getFile = (path: string) => files.find(f => f.path === path || f.path === `/${path}`);
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

  return repaired;
}
