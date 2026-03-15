# Deployment and Ollama Tunneling

## Cloudflare Pages

Production URL:
`https://avatars-zbe.pages.dev`

The GitHub Actions workflow deploys `apps/web/dist` on pushes to `main`.

Required GitHub Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT`

## Local Ollama Over The Web (Quest 3 / iPad / XREAL)

### 1) Run Ollama and allow browser origins
```bash
OLLAMA_ORIGINS="https://avatars-zbe.pages.dev" ollama serve
```

If you also use a Cloudflare tunnel, include the tunnel URL:
```bash
OLLAMA_ORIGINS="https://avatars-zbe.pages.dev,https://your-tunnel.trycloudflare.com" ollama serve
```

### 2) Create a public tunnel to your local Ollama
```bash
cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"
```

You will get a URL like:
`https://your-tunnel.trycloudflare.com`

### 3) Point the app to the tunnel URL
Set this in the app you are running:

`apps/web/.env.local`
```env
VITE_LLM_PROVIDER=ollama
VITE_LLM_OLLAMA_API_URL=https://your-tunnel.trycloudflare.com
VITE_LLM_OLLAMA_MODEL=gemma3:1b
```

`apps/vision-pro/.env.local`
```env
VITE_LLM_PROVIDER=ollama
VITE_LLM_OLLAMA_API_URL=https://your-tunnel.trycloudflare.com
VITE_LLM_OLLAMA_MODEL=gemma3:1b
```

### Optional convenience scripts
From the repo root:

```bash
pnpm ollama:serve
pnpm ollama:tunnel
```

You can override defaults:
```bash
OLLAMA_ORIGINS="https://avatars-zbe.pages.dev,https://your-tunnel.trycloudflare.com" pnpm ollama:serve
OLLAMA_HOST_URL="http://localhost:11434" pnpm ollama:tunnel
```

## Notes
- `cloudflared` must be installed and authenticated.
- Use HTTPS for WebXR on headsets.
