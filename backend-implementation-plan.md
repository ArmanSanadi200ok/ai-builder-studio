# Backend Implementation Plan: AI Builder Studio

## 1. Architecture Overview
**Stack:** Next.js 16 App Router, Vercel (Edge/Serverless), PostgreSQL (Neon), Drizzle ORM, Inngest (Background Jobs), E2B (Sandboxing), Auth.js (NextAuth), Upstash Redis (Rate limiting).
**Data Flow:** Browser (Client) → Next.js Server Actions (Auth, DB Updates, Quota Check) → Inngest Trigger → Inngest Workflow Orchestrator → Vercel AI SDK / E2B Sandbox → DB Status Update → Browser (Polling/SWR UI Update).

---

## 2. Database Schema (Drizzle ORM)
Using PostgreSQL with standard normalized tables to ensure complete project history and state recovery.

```typescript
// Users & Auth (NextAuth standard)
User { id, email, name, image, createdAt }
Account { id, userId, type, provider, providerAccountId, access_token, ... }
Session { sessionToken, userId, expires }

// Secrets
UserAPIKey { id, userId, provider, encryptedKey, iv, createdAt, updatedAt }

// Core Project
Project { id, userId, name, description, status, selectedProvider, selectedModel, githubRepoUrl, vercelDeployUrl, vercelProjectId, createdAt, updatedAt }

// Revisions
ProjectVersion { id, projectId, userId, promptUsed, versionNumber, createdAt }
ProjectFile { id, versionId, path, content, createdAt }

// AI Operations
Message { id, projectId, userId, role, content, createdAt }
GenerationRun { id, projectId, userId, status, userPrompt, provider, model, tokensUsed, errorLog, retryCount, startedAt, completedAt }

// Deployments
GitHubConnection { id, userId, encryptedToken, iv }
VercelConnection { id, userId, encryptedToken, iv }
```

---

## 3. Data Flow & Persistence
1. User submits a prompt from the Workspace UI.
2. A Next.js Server Action validates the input, authenticates the user, and checks Quota/BYOK.
3. The Action inserts records into `Project`, `ProjectVersion`, `Message`, and `GenerationRun` with a `Queued` status.
4. The Action dispatches an event (`abs.generation.requested`) to Inngest and immediately returns `200 OK` to the UI.
5. The UI enters a polling or subscription state, observing the database status.
6. The Inngest worker executes the pipeline. **Crucially, if the user closes their browser here, the backend pipeline safely continues.**
7. When the user returns, the UI simply fetches the latest `ProjectVersion` files and current `status`.

---

## 4. Security Model
- **Credentials:** AES-256-GCM encryption for all sensitive tokens (`UserAPIKey`, `GitHubConnection`, `VercelConnection`). Decryption happens strictly in-memory during Vercel serverless execution.
- **Master Key:** Sourced from `ENCRYPTION_MASTER_KEY` in Vercel environment variables.
- **Execution:** Zero arbitrary code execution inside the ABS Vercel environment. E2B ephemeral microVMs isolate all generated code and build steps.
- **Frontend Safety:** The client never receives API keys, OAuth access tokens, or raw deployment secrets.

---

## 5. Provider Abstraction & BYOK Priority Logic
- **Abstraction:** The Vercel AI SDK acts as the universal wrapper. A dynamic factory function `getAIModel(provider, model, decryptedKey)` instantiates the appropriate adapter (`@ai-sdk/openai`, `@ai-sdk/google`, etc.).
- **BYOK Priority Logic:**
  1. Retrieve `UserAPIKey` where `provider = project.selectedProvider`. If found and valid → Use BYOK.
  2. If no BYOK → Check Upstash Redis limit. If under limit (2 prompts/day) → Use ABS-managed environment variable keys.
  3. If over limit → Reject generation, prompting user to add their own key.

---

## 6. Quota Logic (Upstash Redis)
- **Key Structure:** `rate_limit:prompts:${userId}:${YYYY-MM-DD}`
- **Constraint:** Max 2 requests per 24h period for managed keys.
- **Cost Protection:** Internal debugging loops, planning, and self-healing requests do **not** increment this Redis key. Instead, they are constrained by a strict `GenerationRun.retryCount` limit (max 3) and hardcoded `maxTokens` budget per Vercel AI SDK call.

---

## 7. Inngest Background Generation Workflow
- **Event:** `abs.generation.requested`
- **Step 1:** Run Planning AI Prompt to determine file structure.
- **Step 2:** Generate file contents in parallel/sequence.
- **Step 3:** Commit files to DB as `ProjectFile` entities.
- **Step 4:** Invoke E2B Sandbox lifecycle for build and validation.

---

## 8. E2B Sandbox & Self-Healing Debug Pipeline
- **Execution:** Start an E2B Sandbox. Write `ProjectFile`s to the container filesystem. Run `npm install` and `npm run build`.
- **Validation (Success):** If the exit code is `0`, E2B exposes the preview port. Return the proxy URL, save to DB, mark `Project` as `Ready`.
- **Self-Healing (Failure):**
  1. If exit code `!= 0`, capture `stderr` and failing file contents.
  2. Increment `retryCount`. If `retryCount > 3`, mark `Failed` and halt workflow.
  3. Construct a strictly constrained debug prompt containing the error logs and previous context.
  4. Receive patch, apply to DB and E2B, loop back to `npm run build`.

---

## 9. GitHub & Vercel Integration
- **GitHub:** Implement standard OAuth. Store token encrypted. When a user initiates deployment, use the `octokit` REST API to `createRepository` and push `ProjectFile`s to the `main` branch.
- **Vercel:** Implement Vercel OAuth. Store token encrypted. Call Vercel REST API to link the new GitHub repository, triggering an automated deployment. Store the `vercelDeployUrl` upon success.

---

## 10. Required Environment Variables
```env
# Database
DATABASE_URL=postgres://...

# Security
ENCRYPTION_MASTER_KEY=...
AUTH_SECRET=...

# Auth Providers
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# External Services
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
E2B_API_KEY=...

# ABS Managed AI Keys
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
```

---

## 11. Dependency List
Minimal footprint additions:
- **DB:** `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`
- **Auth:** `next-auth@beta` (v5 for App Router)
- **Limits:** `@upstash/redis`
- **Jobs:** `inngest`
- **Sandbox:** `@e2b/code-interpreter`
- **AI:** `ai`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/groq`
- **Deploy:** `octokit`

---

## 12. Implementation Phases

- **Phase 1: Database + Drizzle + environment configuration**
  - Setup Neon Postgres, define Drizzle schemas, configure migrations.
- **Phase 2: Authentication + user accounts**
  - Configure NextAuth.js (Auth.js), link Google/GitHub OAuth, wire up existing `/login` and `/signup` UI.
- **Phase 3: Project + history + versions**
  - Implement DB operations for Projects. Connect existing Dashboard UI to fetch real history.
- **Phase 4: AI provider abstraction + BYOK**
  - Create the AI factory. Implement AES-256-GCM logic for storing/retrieving API keys securely.
- **Phase 5: Quota + Upstash Redis**
  - Implement the daily prompt rate-limiting middleware for ABS-managed keys.
- **Phase 6: Inngest background generation**
  - Setup Inngest API route. Build the main event workflow, executing the initial AI SDK generation steps.
- **Phase 7: E2B sandbox + live preview**
  - Connect E2B to the Inngest workflow. Push generated code, extract proxy URL, and display in the Workspace iframe.
- **Phase 8: Self-healing/debug pipeline**
  - Implement the `try/catch` build logic inside Inngest, catching errors and looping back to the AI for patching.
- **Phase 9: GitHub integration**
  - OAuth setup for GitHub deployments. Octokit logic for repository creation and file pushing.
- **Phase 10: Vercel integration**
  - OAuth setup for Vercel. REST API triggers to link GitHub and initiate live deployments.
- **Phase 11: Production security + observability**
  - Final audits, Axiom/Vercel logs integration, strict error boundary implementations.

---

## 13. Risks & Testing Strategy
- **Risk:** Slow E2B Sandbox dependencies (`npm install` taking several minutes).
- **Mitigation:** Rely heavily on Inngest's step timeouts. Pre-bake a custom E2B environment with Next.js/Tailwind node_modules globally cached to reduce cold boot time.
- **Risk:** AI Hallucination infinite loops during self-healing.
- **Mitigation:** Hardcap at 3 retries. Always feed the exact previous error and failed patch attempt into the next debug prompt to force course correction.
- **Testing:** Each phase will be manually validated end-to-end locally before proceeding to the next. No components or UI routing will be broken during the backend scaffolding.
