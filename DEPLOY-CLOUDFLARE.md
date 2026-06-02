# Deploy Tempamail.org on Cloudflare Pages (free)

Your site is a static HTML/CSS/JS project — ideal for [Cloudflare Pages](https://pages.cloudflare.com/) (generous free tier, global CDN).

## Option A — Connect GitHub (recommended)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Authorize GitHub and select repo: `komolafeopeyemi800-tech/tempamail-landing`.
4. Build settings:
   - **Production branch:** `master`
   - **Framework preset:** None
   - **Build command:** (leave empty)
   - **Build output directory:** `/` or `.`
5. Click **Save and Deploy**.

**Important:** Do **not** set a custom **Deploy command** like `npx wrangler deploy`. That command is for **Workers**, not static Pages. See [Fix deploy errors](#fix-deploy-errors-wrangler-deploy) below.

After deploy you get a URL like `https://tempamail-landing.pages.dev`.

### Fix deploy errors (`wrangler deploy`)

If your build log shows:

```text
Executing user deploy command: npx wrangler deploy
Missing entry-point to Worker script or to assets directory
```

**Cause:** Cloudflare is trying to deploy a **Worker**, but this repo is a **static HTML site** (no `src/index.ts`, no Worker).

**Fix in the Cloudflare dashboard:**

1. Open your **Pages** project (not Workers).
2. Go to **Settings** → **Build** (or **Builds & deployments**).
3. Set:

| Setting | Correct value |
|---------|----------------|
| Framework preset | **None** |
| Build command | *(leave completely empty)* |
| Build output directory | `.` or `/` |
| **Deploy command** | *(delete / leave empty)* — **do not use** `npx wrangler deploy` |

4. **Save**, then **Retry deployment** or push a small commit to GitHub.

**Wrong vs right:**

| Wrong | Right |
|-------|--------|
| `npx wrangler deploy` | *(no deploy command — Cloudflare uploads static files automatically)* |
| Workers project | **Pages** project connected to Git |

**Only if** your dashboard forces a deploy command, use:

```bash
npx wrangler pages deploy . --project-name=YOUR_PAGES_PROJECT_NAME
```

Replace `YOUR_PAGES_PROJECT_NAME` with the exact name in Cloudflare Pages (e.g. `tempamail-landing`).

### Custom domain (tempamail.org)

1. In the Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `tempamail.org` (and `www.tempamail.org` if needed).
3. If the domain is already on Cloudflare DNS, records are added automatically.
4. SSL is provisioned automatically (usually within minutes).

### Google Search Console

The verification meta tag is already in `index.html`. After DNS points to Cloudflare, verify in Search Console.

---

## Option B — Deploy from your PC (Wrangler CLI)

```bash
npx wrangler login
npx wrangler pages deploy . --project-name=tempamail-landing
```

First run creates the Pages project if it does not exist.

---

## Connect Cloudflare MCP in Cursor (optional)

MCP lets the AI help manage DNS, Pages, and other Cloudflare settings. It does **not** replace the deploy steps above.

Per [Cloudflare's MCP documentation](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/):

1. Open **Cursor Settings** → **MCP** → **Add new MCP server**.
2. Add a remote server:

```json
{
  "mcpServers": {
    "cloudflare-api": {
      "url": "https://mcp.cloudflare.com/mcp"
    }
  }
}
```

3. Save and restart Cursor if prompted.
4. On first use, complete **OAuth** in the browser and choose account permissions.

For automation/CI, use an [API token](https://dash.cloudflare.com/profile/api-tokens) with Pages + DNS permissions instead of OAuth.

---

## Files used by Cloudflare Pages

| File | Purpose |
|------|---------|
| `_redirects` | SPA-style fallback to `index.html` |
| `_headers` | Security and cache headers |
| `wrangler.toml` | Optional CLI deploy config |

`netlify.toml` is ignored by Cloudflare and can stay if you ever use Netlify again.
