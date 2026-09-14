import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { generateProject } from "@/inngest/functions/generateProject";
import { startPreviewSandbox } from "@/inngest/functions/startPreview";

export const maxDuration = 300; // 5 minutes max duration for Vercel functions

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateProject,
    startPreviewSandbox,
  ],
});
