# AI Builder Studio (ABS) - Backend Architecture Specification

## 1. Executive Summary

AI Builder Studio (ABS) is a Next.js-based, Vercel-hosted platform enabling users to generate, test, debug, and deploy full-stack applications via natural language. Given the explicit constraints—avoiding a Django/monolithic backend, embracing Vercel's serverless environment, and ensuring long-running AI generation jobs persist regardless of client connection state—the architecture relies on **event-driven, serverless background jobs** (via Inngest or similar) and **ephemeral cloud sandboxes** (via E2B) for safe code execution. This ensures maximum scalability, high resilience, and zero operational overhead of traditional always-on servers.

---

## 2. Architecture Diagram

```mermaid
graph TD
    Client[Browser / Next.js UI]
    Vercel[Vercel Serverless / Edge]
    DB[(PostgreSQL Database)]
    Redis[(Upstash Redis)]
    Jobs[Job Queue / Inngest Worker]
    Sandbox[E2B Execution Sandbox]
    AI_Providers[AI Providers: OpenAI, Anthropic, Gemini, Groq]
    Github[GitHub API]
    VercelDeploy[Vercel Deploy API]

    Client <-->|REST / Server Actions| Vercel
    Vercel <-->|Auth & CRUD| DB
    Vercel -->|Trigger Event| Jobs
    Jobs <-->|Step Execution| DB
    Jobs <-->|Rate Limits| Redis
    Jobs <-->|Prompt Generation| AI_Providers
    Jobs <-->|Execute Code| Sandbox
    Jobs -->|Push Code| Github
    Jobs -->|Trigger Deployment| VercelDeploy
    Client <..>|Real-time Events / Polling| DB
    Client <..>|Iframe Preview URL| Sandbox
```

---

## 3. Technology Stack

- **Framework**: Next.js 16.x App Router (TypeScript)
- **Deployment**: Vercel (Serverless Functions & Edge Network)
- **Database**: PostgreSQL (hosted via **Neon** or **Supabase** for optimal Serverless connection pooling)
- **ORM**: **Drizzle ORM** (Lightweight, incredibly fast for serverless cold starts compared to Prisma)
- **Background Jobs**: **Inngest** (Ideal for Vercel; allows durable step-functions, sleeps, and retries without serverless timeouts)
- **Authentication**: **NextAuth.js (Auth.js)** (Native Next.js integration for OAuth and secure session handling)
- **AI Gateway**: **Vercel AI SDK** (Provides unified abstractions over various LLMs)
- **Execution Sandbox**: **E2B** (Specialized cloud environments for AI agents to run/build arbitrary code safely)
- **Rate Limiting/Caching**: **Upstash Redis** (Serverless Redis)

---

## 4. Request/Data Flow

1. **User Request**: User submits a prompt in the UI ("Create my portfolio").
2. **API Ingestion**: Next.js Server Action validates the prompt, checks quota in Redis, and creates a `Project` and `GenerationRun` record in the DB with status `Queued`.
3. **Event Dispatch**: The API triggers an Inngest event (`project.generate`).
4. **Background Execution**: The Vercel API responds `200 OK` to the browser immediately. Inngest takes over in the background.
5. **Job Lifecycle**: The Inngest workflow orchestrates the AI Generation Pipeline (Prompt -> Generate -> Sandbox Build -> Auto-debug -> Save).
6. **Client Updates**: The Next.js client listens to DB changes via polling (SWR/React Query) or Supabase Realtime to update the UI ("Generating...", "Building...", "Ready").

---

## 5. AI Provider Architecture

To support switching providers (OpenRouter, Gemini, Groq, OpenAI) without changing project state:
- Use **Vercel AI SDK Core**. It normalizes model instantiation (`generateText`, `streamText`) across providers.
- The DB `Project` schema contains `aiProvider` and `aiModel` fields.
- A factory function `getAIModel(provider, model, credentials)` dynamically initializes the correct provider SDK at runtime.
- **Context Preservation**: Conversations and files are stored agnostic of the provider. When continuing a project with a new model, the system reconstructs the history into the standard unified message array format.

---

## 6. BYOK & Credential Management

Users can provide their own API keys, or fall back to ABS-managed keys if their plan permits.
- **Priority Logic**: The backend checks `UserAPIKey` records for the selected provider first. If missing, it checks the user's managed quota before using the internal ABS `process.env` fallback key.
- **Encryption**: Keys provided by the user MUST NOT be stored in plaintext. Use AES-256-GCM encryption before saving to the DB.
- **Master Key**: The encryption master key is stored securely in Vercel Environment Variables.
- **Memory Only**: Decryption happens strictly in memory within the Vercel serverless function right before making the AI request. It is never exposed to the frontend.

---

## 7. Managed AI Usage & Quotas

- **User Prompt vs Internal Prompt**: A "User Prompt" is the single intentional request from the user. "Internal Prompts" (planning, debugging, validation) are child executions of the user prompt.
- **Quota Tracking**: Track `user_prompts_count` in Redis (reset daily) for ABS-managed usage.
- **Budgeting Internal Prompts**: Every background job is initialized with a `max_tokens` or `max_cost` budget. If the self-healing loop exceeds this limit, it aborts gracefully to prevent infinite billing loops.
- **Consent**: If a user runs out of free managed prompts, the UI blocks further generation and requests they upgrade or supply a BYOK.

---

## 8. AI Generation Pipeline

1. **Planning**: AI analyzes request and generates a JSON array of files to create/modify.
2. **Generation**: AI generates the file contents (can be parallelized).
3. **Storage**: Files are committed to the DB as `ProjectFiles`.
4. **Environment Prep**: An E2B sandbox is initialized. Files are written to the sandbox filesystem.
5. **Install**: `npm install` runs in the sandbox.
6. **Build/Start**: `npm run build` or `npm run dev` is executed.
7. **Validation**: The pipeline waits for the server to bind to a port or for the build command to exit successfully.
8. **Finalization**: Sandbox proxy URL is passed back to the DB to display in the Live Preview.

---

## 9. Self-Healing Debug Pipeline

When `npm run build` or `npm run dev` throws an error in the sandbox:
1. **Detect**: The Inngest job captures `stderr` and the exit code.
2. **Analyze**: An internal AI prompt is constructed: *"The project failed to build. Here is the code for X, and here is the error: [stderr]. Provide the corrected code."*
3. **Repair Strategy**: The AI responds with file patches (or full file replacements).
4. **Re-execute**: Files are updated in the sandbox and the build is retried.
5. **Escalation**: 
   - **Limit**: Max 3 automatic retries.
   - **Failure**: If it fails 3 times, the job stops. The DB status is set to `Failed`. The user is shown the error and asked to help guide the AI to a fix manually.

---

## 10. Background Job Architecture

**Recommendation**: **Inngest** (or Trigger.dev).
- **Why**: Standard Vercel Serverless functions timeout after 10-60 seconds. Vercel Background Functions are deprecated/limited. Inngest operates via step-functions where state is maintained externally. A 5-minute build process is just a series of short webhook triggers between Inngest and Vercel.
- **Durability**: If the user closes the browser, Inngest retains the job state and continues executing steps in the background.
- **Resilience**: Step failures can be automatically retried.

---

## 11. Database Architecture

**Recommended DB**: PostgreSQL (Neon for serverless pooling).

**Key Entities**:
- **User**: Authentication details, subscription tier.
- **UserAPIKey**: Encrypted BYOK credentials (provider, encryptedKey, iv).
- **Project**: metadata, status (Draft, Queued, Generating, Ready, Failed), selectedProvider, selectedModel, githubRepoUrl, vercelDeployUrl.
- **ProjectVersion (Snapshot)**: Groups files for a specific version in time.
- **ProjectFile**: path, content, versionId.
- **Message / Prompt**: Chat history linking user instructions to internal GenerationRuns.
- **GenerationRun**: Tracks a specific background job (status, tokensUsed, errorLog).
- **GitHubConnection / VercelConnection**: OAuth tokens for user's deployment accounts.

---

## 12. Project & Version History

**Strategy**: **Snapshot / Complete File Storage**.
- Given AI-generated projects are relatively small (usually <50 files), storing full file snapshots per major user prompt is vastly simpler and more reliable than calculating complex Git-style diffs in the database.
- Every time a User Prompt completes successfully, a new `ProjectVersion` is created, and all `ProjectFiles` are duplicated and attached to it.
- **Benefit**: The user can easily "Undo" by restoring a previous `ProjectVersion` snapshot.

---

## 13. Sandbox/Live Preview Architecture

**Recommendation**: **E2B (e2b.dev)**.
- **Isolation**: E2B provides secure, ephemeral Firecracker microVMs. AI-generated code runs here, entirely isolated from the ABS Vercel environment. No malicious code can access the ABS database or secrets.
- **Preview**: E2B automatically exposes ports running in the sandbox to a public proxy URL (e.g., `https://[sandbox-id]-3000.e2b.dev`). This URL is embedded in an `<iframe>` in the ABS frontend.
- **Lifecycle**: Sandboxes have an idle timeout. If a user returns after 2 hours, the backend checks if the sandbox is dead, spins up a new one, injects the `ProjectFiles` from the DB, and runs `npm run dev` to restore the preview instantly.

---

## 14. Authentication Architecture

**Recommendation**: **NextAuth.js (Auth.js)** v5.
- Connects directly to the Drizzle/Postgres database.
- Provides built-in Google and GitHub OAuth providers.
- Secure HTTP-only cookies for session management.
- API keys and internal tracking are mapped safely via the NextAuth `userId`.

---

## 15. GitHub Integration

- **Flow**: User clicks "Connect GitHub" -> Standard OAuth flow -> ABS receives GitHub Access Token (stored encrypted).
- **Action**: When a user clicks "Deploy", a serverless function uses `octokit` (GitHub REST API) using the user's token to:
  1. Create a repository on their account.
  2. Push the current DB `ProjectFiles` to the `main` branch.

---

## 16. Vercel Integration

- **Flow**: User clicks "Connect Vercel" -> Vercel OAuth flow -> ABS receives Vercel Access Token (stored encrypted).
- **Action**: Once the GitHub repo is created, ABS calls the Vercel REST API to:
  1. Create a new Vercel Project linked to the newly created GitHub repository.
  2. Vercel automatically triggers a deployment.
  3. ABS polls Vercel (or receives a webhook) to update the `Project` deployment status to `Deployed` and saves the live URL.

---

## 17. Security Architecture

- **Execution**: E2B ensures total code isolation. ABS Vercel environments NEVER execute `eval()` or run user/AI generated code.
- **Secrets**: AES-256-GCM for API keys and OAuth tokens. Vercel environment variables hold the master encryption key and ABS internal provider keys.
- **SSRF Prevention**: Since execution happens in E2B, SSRF attacks target the E2B VM, which has no access to ABS internal networks or VPCs.
- **Preview Isolation**: Preview iframes should use `sandbox="allow-scripts allow-same-origin allow-forms"` and appropriate CSP headers.

---

## 18. Observability

- **Logs**: **Axiom** or **Datadog** integrated natively via Vercel log drains.
- **Metrics**: Log AI token consumption per generation run, separating BYOK from Managed quotas. Track sandbox startup times and self-healing success rates.
- **Traceability**: Every Inngest background step emits structured logs tied to a `projectId` and `runId`.

---

## 19. Cost Control

- **Redis Token Buckets**: Upstash Redis maintains rolling windows for User Prompts (e.g., 2 per 24 hours).
- **Internal Limits**: `max_tokens` param is strictly enforced on Vercel AI SDK calls to prevent a single hallucination from costing dollars.
- **Timeouts**: Sandbox build commands have strict timeouts (e.g., 120 seconds). If `npm install` hangs, the process is killed and sent to the self-healing loop.

---

## 20. Failure & Recovery

- **Provider Outage**: AI provider returns 5xx -> Inngest auto-retries with exponential backoff up to 4 times. If persistent, UI notifies user to try a different provider.
- **Invalid BYOK**: 401 Unauthorized -> Job halts immediately. UI prompts user to update API key.
- **Sandbox Crash**: E2B instance dies -> Job provisions a new sandbox, injects files, and continues.
- **Browser Closure**: Irrelevant to execution. Inngest controls the state machine. The client fetches the latest state from the DB upon reopening.

---

## 21. MVP vs Future Architecture

**Phase 1 (MVP)**:
- Next.js + Neon Postgres + Drizzle ORM
- Inngest for Jobs
- E2B for Sandboxes
- NextAuth for Auth + GitHub Deployments
- Snapshots for versions.

**Future Architectures**:
- Move from Inngest to custom Kubernetes workers if execution volumes get astronomically high (cost optimization).
- Move from E2B to self-hosted Firecracker clusters to reduce sandbox per-second billing.
- Implement Git-style delta diffs for file storage to save DB space.

---

## 22. Recommended Folder/Module Structure

```
src/
├── app/                  # Next.js Routes & UI
│   ├── api/
│   │   ├── auth/         # NextAuth route
│   │   ├── inngest/      # Inngest webhook endpoint
│   │   └── webhooks/     # Vercel/GitHub webhooks
├── server/
│   ├── db/               # Drizzle schema, connection, migrations
│   ├── ai/               # AI Provider factory, system prompts
│   ├── jobs/             # Inngest step definitions and orchestrators
│   ├── sandbox/          # E2B SDK wrappers and execution logic
│   ├── security/         # AES encryption/decryption utilities
│   └── actions/          # Next.js Server Actions (UI to Backend glue)
```

---

## 23. API/Server Interface Design

- **Mutations (Triggering Work)**: Use **Next.js Server Actions**. They provide end-to-end type safety without writing manual API routes (e.g., `submitPrompt(projectId, text)`).
- **Queries (Fetching Data)**: Server Components fetch directly from the DB on initial load. Client components use SWR/React Query hitting simple GET API routes to poll for status updates while generation is active.
- **Background Orchestration**: Server Actions only update the DB and trigger an Inngest event, returning immediately.

---

## 24. Deployment Architecture

- **Frontend & APIs**: Vercel (Edge for middleware/auth, Serverless for API/Actions).
- **Database**: Neon (Serverless Postgres with connection pooling).
- **Redis**: Upstash (Serverless Redis for caching/rate limits).
- **Workers**: Inngest Cloud manages the queue and hits Vercel Serverless endpoints to execute steps.

---

## 25. Open Decisions / Risks

1. **Dependency Hell**: AI models frequently generate code using outdated or incompatible npm packages. **Mitigation**: Pre-bake E2B sandboxes with standard Next.js templates and forcefully append known-good `package.json` dependencies if the AI struggles.
2. **Cold Starts vs Live Preview**: When a user returns to a project after hours, E2B takes 3-10 seconds to spin up, plus the time to run `npm run dev`. **Mitigation**: Show a skeleton loader in the preview iframe indicating "Waking up environment...".
3. **Runaway Loops**: Self-healing might result in the AI flipping back and forth between two erroneous states. **Mitigation**: The self-healing prompt must strictly include the history of previous failed attempts in the same run to force the AI down a new path. Hardcap at 3 retries.
