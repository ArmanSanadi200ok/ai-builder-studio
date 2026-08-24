import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { generateProject } from "@/inngest/functions/generateProject";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateProject,
  ],
});
