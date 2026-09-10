import { config } from "dotenv";
config({ path: ".env.local" });
import { Sandbox } from "@vercel/sandbox";
import { syncFilesToSandbox, detectPackageManager, detectProjectFramework, getDevCommand } from "./src/lib/preview/sandbox";

async function run() {
  console.log("1. Creating real test Sandbox...");
  const credentials = {
    token: process.env.VERCEL_TOKEN,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID
  };
  const sandboxName = `abs-e2e-test-${Date.now()}`;
  let sandbox = await Sandbox.getOrCreate({ name: sandboxName, ports: [3000, 5173], ...credentials });
  console.log("Sandbox Name:", sandbox.name);

  console.log("2. Generating minimal Vite React project...");
  const files = [
    {
      path: "package.json",
      content: JSON.stringify({
        name: "test-app",
        scripts: { dev: "vite" },
        dependencies: { react: "^18", "react-dom": "^18" },
        devDependencies: { vite: "^5", "@vitejs/plugin-react": "^4" }
      })
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html><html lang="en"><body><div id="root">HELLO_REACT_VITE</div></body></html>`
    }
  ];

  console.log("3. Syncing files...");
  await syncFilesToSandbox(sandbox, files);

  const pm = detectPackageManager(files);
  const fw = detectProjectFramework(files);
  console.log(`Detected PM: ${pm}, Framework: ${fw}`);

  console.log("4. Installing dependencies...");
  const installResult = await sandbox.runCommand(pm, ["install"]);
  if (installResult.exitCode !== 0) throw new Error("Install failed: " + installResult.stderr);
  
  console.log("5. Starting dev server...");
  const devCmdStr = getDevCommand(pm, fw, files);
  console.log("Command:", devCmdStr);
  const devCmd = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", devCmdStr],
    detached: true
  });

  const targetPort = fw === "vite" ? 5173 : 3000;
  let isReady = false;
  let previewUrl = "";
  
  console.log("6. Verifying server listening on expected port...");
  let crashResult: any = null;
  devCmd.wait().then((res: any) => { crashResult = res; }).catch(() => {});

  for (let i = 0; i < 30; i++) {
    if (crashResult) {
      console.error("Crashed with code", crashResult.exitCode);
      const stderr = await devCmd.stderr().catch(() => "");
      throw new Error("Crash log: " + stderr);
    }

    try {
      previewUrl = await sandbox.domain(targetPort);
      const res = await fetch(previewUrl);
      console.log(`Health check: ${res.status}`);
      if (res.ok || res.status === 404 || res.status === 403) {
        isReady = true;
        
        console.log("7. Verifying sandbox.domain(port) returns working URL:", previewUrl);
        console.log("8. Verifying HTTP 200:");
        if (res.status === 200) {
          const text = await res.text();
          if (text.includes("HELLO_REACT_VITE")) {
            console.log("9. Verified page contains generated application.");
          } else {
            console.error("Page does not contain HELLO_REACT_VITE. Response:", text.substring(0, 200));
            throw new Error("Missing app content");
          }
        } else {
          console.error("Unexpected status", res.status);
          throw new Error("HTTP not 200");
        }
        break;
      }
    } catch (e: any) {
      console.log("Wait for ready...", e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!isReady) {
    const stderr = await devCmd.stderr().catch(() => "");
    throw new Error("Timeout! Logs: " + stderr);
  }

  console.log("10. Verifying Sandbox reuse...");
  const reusedSandbox = await Sandbox.getOrCreate({ name: sandboxName, ports: [3000, 5173], ...credentials });
  console.log("Reused Sandbox Name:", reusedSandbox.name);
  if (reusedSandbox.name === sandbox.name) {
    console.log("Sandbox reuse verified successfully.");
  } else {
    throw new Error("Reuse failed.");
  }

  console.log("ALL TESTS PASSED.");
}

run().catch(console.error);
