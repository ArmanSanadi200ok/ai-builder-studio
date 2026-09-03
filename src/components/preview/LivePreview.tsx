"use client";

import React, { useEffect, useState } from "react";

interface LivePreviewProps {
  files: { path: string; content: string }[];
}

export function LivePreview({ files }: LivePreviewProps) {
  const [srcDoc, setSrcDoc] = useState("");
  const [previewState, setPreviewState] = useState<"building" | "ready" | "failed">("building");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setPreviewState("building");

    const timer = setTimeout(() => {
      setPreviewState(prev => prev === "building" ? "failed" : prev);
    }, 10000);

    const handleMessage = (e: MessageEvent) => {
      if (e.data === "preview-ready") {
        setPreviewState("ready");
        clearTimeout(timer);
      } else if (e.data && e.data.type === "preview-error") {
        setPreviewState("failed");
        setErrorMessage(e.data.message || "An unknown error occurred in the preview.");
        clearTimeout(timer);
      }
    };
    
    window.addEventListener("message", handleMessage);

    const html = generateSrcDoc(files);
    setSrcDoc(html);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
    };
  }, [files]);

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden bg-white">
       {previewState === "building" && (
         <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f11] z-10">
           <div className="flex flex-col items-center">
             <span className="material-symbols-outlined text-[48px] animate-spin text-[#00a2e6] mb-4">sync</span>
             <p className="text-on-surface-variant font-mono text-sm">Building Preview...</p>
           </div>
         </div>
       )}
       {previewState === "failed" && (
         <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f11] z-10">
           <div className="flex flex-col items-center">
             <span className="material-symbols-outlined text-[48px] text-error mb-4">error</span>
             <p className="text-on-surface-variant font-mono text-sm">Preview Build Failed</p>
             <p className="text-xs text-on-surface-variant/70 mt-2 max-w-xs text-center break-words px-4">
               {errorMessage || "The generated code may contain infinite loops, syntax errors, or unresolvable imports."}
             </p>
           </div>
         </div>
       )}
       <iframe
          srcDoc={srcDoc}
          sandbox="allow-scripts" // EXPLICITLY OMITTING allow-same-origin for sandbox security
          className="w-full h-full border-none bg-white"
       />
    </div>
  );
}

function generateSrcDoc(files: { path: string; content: string }[]) {
  const indexHtml = files.find(f => f.path.toLowerCase() === "index.html" || f.path.toLowerCase() === "public/index.html")?.content;
  
  const cssFiles = files.filter(f => f.path.endsWith(".css"));
  const cssContent = cssFiles.map(f => f.content).join("\n");

  const otherFiles = files.filter(f => f.path.endsWith(".tsx") || f.path.endsWith(".ts") || f.path.endsWith(".js") || f.path.endsWith(".jsx"));
  const hasReact = files.some(f => f.path.endsWith(".tsx") || f.path.endsWith(".jsx") || f.content.includes("react"));
  
  // Shim for localStorage / sessionStorage to prevent opaque origin crashes (Rule #1)
  const storageShim = `
    const memoryStorage = new Map();
    const storageMock = {
      getItem: (key) => memoryStorage.has(key) ? memoryStorage.get(key) : null,
      setItem: (key, val) => memoryStorage.set(key, String(val)),
      removeItem: (key) => memoryStorage.delete(key),
      clear: () => memoryStorage.clear(),
      get length() { return memoryStorage.size; },
      key: (i) => Array.from(memoryStorage.keys())[i] || null
    };
    Object.defineProperty(window, 'localStorage', { value: storageMock, writable: true });
    Object.defineProperty(window, 'sessionStorage', { value: storageMock, writable: true });
  `;

  if (hasReact) {
    const bootloaderScript = `
      const files = ${JSON.stringify(otherFiles.map(f => ({
        path: f.path,
        content: f.content.replace(/import\\s+['"][^'"]+\\.css['"];?/g, '')
      })))};

      const importMap = {
        imports: {
          "react": "https://esm.sh/react@18.2.0",
          "react-dom": "https://esm.sh/react-dom@18.2.0",
          "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
          "lucide-react": "https://esm.sh/lucide-react@0.294.0"
        }
      };

      window.onload = () => {
        try {
          function resolveRelativePath(basePath, relativePath) {
            const parts = basePath.split('/');
            parts.pop();
            const relParts = relativePath.split('/');
            for (const part of relParts) {
              if (part === '.') continue;
              if (part === '..') parts.pop();
              else parts.push(part);
            }
            return parts.join('/');
          }

          const rewriteImportsPlugin = function() {
            return {
              visitor: {
                ImportDeclaration(path, state) {
                  const source = path.node.source.value;
                  if (source.startsWith('.')) {
                    let resolvedPath = resolveRelativePath(state.filename, source);
                    if (resolvedPath.startsWith('./')) resolvedPath = resolvedPath.substring(2);
                    if (resolvedPath.startsWith('/')) resolvedPath = resolvedPath.substring(1);
                    path.node.source.value = '@local/' + resolvedPath;
                  }
                }
              }
            };
          };
          
          Babel.registerPlugin('rewrite-imports', rewriteImportsPlugin);

          let mainBlobUrl = null;

          for (const file of files) {
            const filename = file.path.startsWith('./') ? file.path.substring(2) : (file.path.startsWith('/') ? file.path.substring(1) : file.path);
            
            const transpiled = Babel.transform(file.content, { 
              filename: filename,
              presets: ['react', 'typescript'], 
              plugins: ['rewrite-imports']
            }).code;
            
            const blob = new Blob([transpiled], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            
            const localPath = '@local/' + filename;
            const extensionless = localPath.replace(/\\.[^/.]+$/, "");
            
            importMap.imports[localPath] = url;
            importMap.imports[extensionless] = url;
            
            if (filename.match(/(src\\/)?(main|index)\\.(tsx|jsx|ts|js)$/)) {
              mainBlobUrl = url;
            }
          }

          const mapScript = document.createElement('script');
          mapScript.type = 'importmap';
          mapScript.textContent = JSON.stringify(importMap);
          document.head.appendChild(mapScript);

          if (mainBlobUrl) {
            const modScript = document.createElement('script');
            modScript.type = 'module';
            modScript.src = mainBlobUrl;
            document.body.appendChild(modScript);
          } else {
            throw new Error("No entry point (main.tsx or index.tsx) found");
          }

          window.parent.postMessage("preview-ready", "*");

        } catch(err) {
          window.parent.postMessage({ type: 'preview-error', message: err.message, stack: err.stack }, '*');
        }
      };
    `;

    return `
<!DOCTYPE html>
<html>
<head>
  <style>${cssContent}</style>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script>
    ${storageShim}
    
    window.onerror = function(message, source, lineno, colno, error) {
      window.parent.postMessage({ type: 'preview-error', message: message, stack: error?.stack }, '*');
    };
    window.addEventListener('unhandledrejection', function(event) {
      window.parent.postMessage({ type: 'preview-error', message: event.reason?.message || String(event.reason), stack: event.reason?.stack }, '*');
    });
    
    ${bootloaderScript}
  </script>
</head>
<body>
  <div id="root"></div>
</body>
</html>
    `;
  }
  
  if (indexHtml) {
    return indexHtml.replace('</head>', `
      <style>${cssContent}</style>
      <script>
        ${storageShim}
        window.onload = () => { window.parent.postMessage("preview-ready", "*"); };
      </script>
    </head>
    `);
  }

  return `
<html>
<head>
  <script>
    ${storageShim}
    window.onload = () => { window.parent.postMessage("preview-ready", "*"); };
  </script>
</head>
<body style="font-family: sans-serif; padding: 20px;">
  <h2>Preview could not be built automatically.</h2>
  <p>The files generated do not follow a standard format for automatic live preview.</p>
</body>
</html>
  `;
}
