# Tempamail.org — Landing Page

Static one-page site for [tempamail.org](https://tempamail.org). Hosted on **Cloudflare Pages** (free).

## Project structure

```
index.html          Main page
styles.css          Styles
script.js           UI interactions
assets/             Images
_headers            Security & cache headers (Cloudflare)
_redirects          URL rules (Cloudflare)
wrangler.toml       Pages project name (optional CLI)
```

## Deploy on Cloudflare Pages (GitHub)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Repo: `komolafeopeyemi800-tech/tempamail-landing`
3. **Build settings** (must match exactly):

| Setting | Value |
|---------|--------|
| Production branch | `master` |
| Framework preset | **None** |
| Build command | *(empty)* |
| Build output directory | `.` |
| Deploy command | *(empty — do not use `wrangler deploy`)* |

4. **Save and Deploy**

### Custom domain

Pages project → **Custom domains** → add `tempamail.org` (and `www` if needed).

### If the build fails

**Wrong:** `npx wrangler deploy` (Workers — not for this site)

**Right:** Leave build and deploy commands empty. Cloudflare uploads static files automatically.

CLI alternative:

```bash
npx wrangler login
npx wrangler pages deploy . --project-name=tempamail-landing
```

## Local preview

Open `index.html` in a browser, or use any static server.

## License

Private project — all rights reserved.
