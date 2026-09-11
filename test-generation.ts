import { config } from "dotenv";
config({ path: ".env.local" });

// IMPORT DB AFTER CONFIG
import { db } from "./src/db";
import { userApiKeys } from "./src/db/schema/users";
import { eq } from "drizzle-orm";
import { decryptKey } from "./src/lib/encryption";

async function makeProviderRequest(apiKey: string, promptStr: string) {
  const filePrompt = "You are an expert developer implementing a project.\n" +
"Project Request: " + promptStr + "\n" +
"Your task is to write the complete content for the file: src/App.tsx\n" +
"Description: Main application component.\n\n" +
"Output ONLY a valid JSON object with a single 'content' string property containing the raw file content.\n" +
"Do NOT output markdown outside the JSON. Do NOT output chain-of-thought, thinking process, or conversational preamble.\n" +
"Example JSON format:\n{\n  \"content\": \"raw file content goes here\"\n}";

  console.log(`\n=== Testing Prompt: ${promptStr.substring(0, 30)}... ===`);

  const payload: any = {
    model: "nvidia/nemotron-3.5-lightning:free",
    messages: [{ role: "user", content: filePrompt }],
    response_format: { type: "json_object" }
  };

  const res = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const rawContent = data.choices[0].message.content;
  
  console.log("Raw Response Length:", rawContent.length);
  
  let parsedContent = rawContent;
  const jsonMatch = parsedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) parsedContent = jsonMatch[1].trim();
  else {
    const braceMatch = parsedContent.match(/(\{|\[)[\s\S]*(\}|\])/);
    if (braceMatch) parsedContent = braceMatch[0];
  }

  try {
    const parsed = JSON.parse(parsedContent);
    const code = parsed.content;
    console.log("JSON Parse: SUCCESS");
    
    // Check heuristics
    let syntaxErrorMsg = "";
    const lowerContent = code.toLowerCase();
    if (lowerContent.includes("here's a thinking process") || lowerContent.includes("here is a thinking process") || lowerContent.includes("sure, i can help") || lowerContent.startsWith("i will write") || lowerContent.startsWith("here is the")) {
       syntaxErrorMsg = "Content appears to contain conversational AI preamble instead of raw source code.";
    }

    if (syntaxErrorMsg) {
       console.log("Validation Failed:", syntaxErrorMsg);
    } else {
       console.log("Validation Passed! Code starts with:", code.substring(0, 100).replace(/\n/g, ' '));
    }
  } catch(e: any) {
    console.error("JSON Parse: FAILED | Reason:", e.message);
  }
}

async function run() {
  const keyRecord = await db.query.userApiKeys.findFirst({
    where: eq(userApiKeys.provider, "openrouter")
  });
  if (!keyRecord) { console.log("No openrouter key in db"); return; }
  
  const apiKey = decryptKey(keyRecord.encryptedKey, keyRecord.iv);
  
  await makeProviderRequest(apiKey, "Build a simple todo app with add, complete, delete and filter functionality.");
  await makeProviderRequest(apiKey, "Create a modern landing page for a SaaS product called SendBeast.");
  await makeProviderRequest(apiKey, "Create a simple calculator.");
  process.exit(0);
}

run().catch(console.error);
