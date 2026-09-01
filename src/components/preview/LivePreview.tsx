"use client";

import React, { useEffect, useState } from "react";

interface LivePreviewProps {
  files: { path: string; content: string }[];
}

export function LivePreview({ files }: LivePreviewProps) {
  const [srcDoc, setSrcDoc] = useState("");
  const [previewState, setPreviewState] = useState<"building" | "ready" | "failed">("building");

  useEffect(() => {
    setPreviewState("building");

    const timer = setTimeout(() => {
      setPreviewState(prev => prev === "building" ? "failed" : prev);
    }, 10000);

    const handleMessage = (e: MessageEvent) => {
      if (e.data === "preview-ready") {
        setPreviewState("ready");
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
             <p className="text-xs text-on-surface-variant/70 mt-2 max-w-xs text-center">
               The generated code may contain infinite loops, syntax errors, or unresolvable imports.
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

  if (hasReact && !indexHtml) {
    const appFile = files.find(f => f.path.toLowerCase().includes("app.tsx") || f.path.toLowerCase().includes("app.jsx") || f.path.toLowerCase().includes("main.tsx"));
    
    // We concatenate files, putting the 'app' file last.
    const componentCode = otherFiles.filter(f => f !== appFile).map(f => f.content).join("\n\n");
    const appCode = appFile ? appFile.content : "";
    
    let allCode = componentCode + "\n\n" + appCode;
    // Strip local relative imports since we are concatenating
    allCode = allCode.replace(/import\s+.*?\s+from\s+['"]\.[^'"]+['"];?/g, '');
    // Strip raw css imports
    allCode = allCode.replace(/import\s+['"][^'"]+\.css['"];?/g, '');
    
    // If there's an export default App, we can grab it, but the easiest way is to let Babel evaluate it
    // and just define a root render point at the bottom if it doesn't already exist.
    const hasRenderCall = allCode.includes("createRoot") || allCode.includes("ReactDOM.render");
    
    let renderInject = "";
    if (!hasRenderCall) {
      renderInject = `
        import { createRoot } from 'react-dom/client';
        // Try to find what to render
        let ComponentToRender = null;
        if (typeof App !== 'undefined') ComponentToRender = App;
        else if (typeof Main !== 'undefined') ComponentToRender = Main;
        else if (typeof Default !== 'undefined') ComponentToRender = Default;
        
        if (ComponentToRender) {
          const root = createRoot(document.getElementById('root'));
          root.render(<ComponentToRender />);
        }
      `;
      // Replace export default with const
      allCode = allCode.replace(/export\s+default\s+(function\s+)?([A-Za-z0-9_]+)/g, 'const $2 = $1');
      allCode = allCode.replace(/export\s+default\s+([A-Za-z0-9_]+);?/g, '');
      // Remove other exports so Babel doesn't complain about exports in a script
      allCode = allCode.replace(/export\s+const/g, 'const');
      allCode = allCode.replace(/export\s+function/g, 'function');
    } else {
       // Just strip exports
       allCode = allCode.replace(/export\s+default/g, '');
       allCode = allCode.replace(/export\s+/g, '');
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <style>${cssContent}</style>
  <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.2.0",
        "react-dom": "https://esm.sh/react-dom@18.2.0",
        "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
        "lucide-react": "https://esm.sh/lucide-react@0.294.0"
      }
    }
  </script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script>
    ${storageShim}
    window.onload = () => { window.parent.postMessage("preview-ready", "*"); };
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
    ${allCode}
    ${renderInject}
  </script>
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
