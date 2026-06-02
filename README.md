# Tempamail.org — Landing Page

Static one-page site for [tempamail.org](https://tempamail.org). Hosted on **Cloudflare Pages** (free).

## Project structure

```
public/               ← deploy this folder only
  index.html
  styles.css
  script.js
  assets/
  _headers
wrangler.toml         Cloudflare config
package.json
```

## Deploy on Cloudflare Pages (GitHub)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Pages** → connect Git
2. Repo: `komolafeopeyemi800-tech/tempamail-landing`
3. **Build settings:**

| Setting | Value |
|---------|--------|
| Production branch | `master` |
| Framework preset | **None** |
| Build command | *(empty)* |
| Build output directory | **`public`** |
| Deploy command | `npx wrangler deploy` *(or leave empty)* |

4. **Save and Deploy**

### Fixes applied in this repo

- **`_redirects` removed** — `/* → /index.html` caused an infinite loop with `wrangler deploy`.
- **`public/` folder** — only site files are deployed; `.git` is not uploaded.

### Custom domain

Pages project → **Custom domains** → `tempamail.org`

## Local preview

Open `public/index.html` in a browser.

## CLI deploy

```bash
npx wrangler login
npm run deploy
# or
npm run pages:deploy
```
