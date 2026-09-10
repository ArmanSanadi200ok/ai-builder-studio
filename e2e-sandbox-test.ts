import { config } from "dotenv";
config({ path: ".env.local" });
import { Sandbox } from "@vercel/sandbox";
import { syncFilesToSandbox, detectPackageManager, detectProjectFramework, getDevCommand } from "./src/lib/preview/sandbox";

async function run() {
  console.log("=== A. Create project & sandbox ===");
  const credentials = {
    token: process.env.VERCEL_TOKEN,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID
  };
  const sandboxName = `abs-e2e-test-${Date.now()}`;
  let sandbox = await Sandbox.getOrCreate({ name: sandboxName, ports: [3000, 5173], ...credentials });
  console.log("Sandbox Name:", sandbox.name);

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

  await syncFilesToSandbox(sandbox, files);
  const pm = detectPackageManager(files);
  const fw = detectProjectFramework(files);
  console.log(`Detected PM: ${pm}, Framework: ${fw}`);

  const installResult = await sandbox.runCommand(pm, ["install"]);
  if (installResult.exitCode !== 0) throw new Error("Install failed");

  console.log("=== B. Start preview ===");
  const targetPort = 5173;
  let devCmdStr = getDevCommand(pm, fw, files);
  
  let isReady = false;
  let previewUrl = "";
  try {
    previewUrl = await sandbox.domain(targetPort);
    const res = await fetch(previewUrl);
    if (res.ok || res.status === 404 || res.status === 403) isReady = true;
  } catch (e) {}

  if (!isReady) {
    await sandbox.runCommand({ cmd: "sh", args: ["-c", `kill -9 $(lsof -t -i:${targetPort}) 2>/dev/null || true`] });
    const devCmd = await sandbox.runCommand({ cmd: "sh", args: ["-c", devCmdStr], detached: true });
    
    for (let i = 0; i < 30; i++) {
      try {
        previewUrl = await sandbox.domain(targetPort);
        const res = await fetch(previewUrl);
        if (res.ok || res.status === 404 || res.status === 403) {
          isReady = true;
          break;
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!isReady) throw new Error("Dev server failed to start");
  }

  console.log("=== C. Confirm preview HTTP 200 ===");
  const res1 = await fetch(previewUrl);
  if (res1.status !== 200 || !(await res1.text()).includes("HELLO_REACT_VITE")) throw new Error("Failed HTTP 200 test 1");
  console.log("HTTP 200 OK!");

  console.log("=== D. Stop/reopen workspace (Simulate by closing connection) ===");
  // We use sandbox.stop() to actually suspend the persistent sandbox and its session
  console.log("Stopping the sandbox session to simulate an idle or suspended workspace...");
  await sandbox.stop();
  // Wait a moment for it to fully stop
  await new Promise(r => setTimeout(r, 2000));

  console.log("=== E. Sandbox is reused ===");
  const reusedSandbox = await Sandbox.getOrCreate({ name: sandboxName, ports: [3000, 5173], ...credentials });
  console.log("Reused Sandbox Name:", reusedSandbox.name);

  console.log("=== F. Dev server is checked & G. Restarted if not running ===");
  isReady = false;
  let reusedPreviewUrl = "";
  try {
    reusedPreviewUrl = await reusedSandbox.domain(targetPort);
    const res2 = await fetch(reusedPreviewUrl);
    if (res2.ok || res2.status === 404 || res2.status === 403) isReady = true;
  } catch (e) {}

  if (!isReady) {
    console.log("Server not running, restarting...");
    await reusedSandbox.runCommand({ cmd: "sh", args: ["-c", `kill -9 $(lsof -t -i:${targetPort}) 2>/dev/null || true`] });
    const devCmd2 = await reusedSandbox.runCommand({ cmd: "sh", args: ["-c", devCmdStr], detached: true });
    
    for (let i = 0; i < 30; i++) {
      try {
        reusedPreviewUrl = await reusedSandbox.domain(targetPort);
        const res3 = await fetch(reusedPreviewUrl);
        if (res3.ok || res3.status === 404 || res3.status === 403) {
          isReady = true;
          break;
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1000));
    }
  } else {
    console.log("Server was ALREADY running (unexpected in this test!)");
    throw new Error("Server shouldn't be running after we killed it!");
  }

  console.log("=== H. Preview becomes HTTP 200 again ===");
  const resFinal = await fetch(reusedPreviewUrl);
  if (resFinal.status !== 200 || !(await resFinal.text()).includes("HELLO_REACT_VITE")) throw new Error("Failed HTTP 200 test final");
  console.log("HTTP 200 OK!");

  console.log("ALL TESTS PASSED.");
}

run().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
