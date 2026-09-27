#!/usr/bin/env node
/**
 * cloudflare-domain.mjs — attach a custom hostname to the Cloudflare Pages project.
 *
 * Two things have to be true for https://avatar.ci.computer to serve this app, and the
 * Pages dashboard does them as two separate clicks:
 *
 *   1. the Pages project must list the hostname as a custom domain, and
 *   2. the ci.computer zone must have a proxied CNAME for it pointing at <project>.pages.dev.
 *
 * This script ensures both, idempotently, so the deploy is reproducible and a rebuilt
 * project or a fresh zone does not need someone to remember the clicks. Run it as often
 * as you like: when everything already matches it changes nothing and exits 0.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   node scripts/cloudflare-domain.mjs --project avatars --domain avatar.ci.computer
 *
 *   --dry-run   report what would change without writing anything
 *
 * The API token needs three permissions, all scoped as narrowly as you like:
 *   Account → Cloudflare Pages → Edit      (read the project, add the custom domain)
 *   Zone    → DNS              → Edit      (create/update the CNAME)
 *   Zone    → Zone             → Read      (resolve ci.computer to its zone id)
 *
 * Exit codes: 0 = ensured (or already correct), 1 = failed. Never partially "succeeds"
 * silently — a step that cannot complete is reported and exits non-zero.
 */
import { pathToFileURL } from 'node:url'

const API = 'https://api.cloudflare.com/client/v4'

export function parseArgs(argv) {
  const args = { dryRun: false }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--project') args.project = argv[++i]
    else if (arg === '--domain') args.domain = argv[++i]
    else if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length)
    else if (arg.startsWith('--domain=')) args.domain = arg.slice('--domain='.length)
    else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return args
}

/**
 * The zone is the registrable domain — the last two labels of the hostname
 * (avatar.ci.computer → ci.computer). Good enough for the *.ci.computer scheme this
 * repo deploys under; a multi-label public suffix would need the real PSL.
 */
export function zoneNameFor(domain) {
  const labels = domain.split('.')
  if (labels.length < 3) {
    // The hostname IS the zone apex (ci.computer), so there is no subdomain to derive.
    return domain
  }
  return labels.slice(-2).join('.')
}

/**
 * Call the Cloudflare API and unwrap its envelope. Every endpoint used here returns
 * `{ success, errors, result }`, and a non-2xx still carries a usable `errors` array —
 * so surface that rather than a bare status code.
 */
async function cf(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  })

  let body
  try {
    body = await res.json()
  } catch {
    throw new Error(`${init.method ?? 'GET'} ${path} → HTTP ${res.status} with a non-JSON body`)
  }

  if (!res.ok || body.success === false) {
    const detail = (body.errors ?? []).map((e) => `${e.code ?? '?'}: ${e.message ?? e}`).join('; ')
    throw new Error(`${init.method ?? 'GET'} ${path} → HTTP ${res.status}${detail ? ` (${detail})` : ''}`)
  }

  return body.result
}

async function main() {
  const { project, domain, dryRun } = parseArgs(process.argv)
  const token = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

  const missing = [
    !token && 'CLOUDFLARE_API_TOKEN',
    !accountId && 'CLOUDFLARE_ACCOUNT_ID',
    !project && '--project',
    !domain && '--domain'
  ].filter(Boolean)

  if (missing.length) {
    console.error(`[cf-domain] missing required input: ${missing.join(', ')}`)
    console.error(
      '[cf-domain] usage: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... ' +
        'node scripts/cloudflare-domain.mjs --project avatars --domain avatar.ci.computer'
    )
    process.exit(1)
  }

  const label = dryRun ? '[cf-domain] (dry run)' : '[cf-domain]'
  console.log(`${label} ensuring ${domain} serves Pages project "${project}"`)

  // 1. Confirm the project exists and learn its canonical *.pages.dev name, which is
  //    the CNAME target. Guessing "<project>.pages.dev" is wrong whenever Cloudflare
  //    had to disambiguate the subdomain (this account's is avatars-zbe.pages.dev).
  const proj = await cf(token, `/accounts/${accountId}/pages/projects/${project}`)
  const target = proj.subdomain
  if (!target) {
    throw new Error(`Pages project "${project}" reports no *.pages.dev subdomain yet — deploy it once first`)
  }
  console.log(`${label} project subdomain: ${target}`)

  // 2. Custom domain on the Pages project.
  const existingDomains = await cf(token, `/accounts/${accountId}/pages/projects/${project}/domains`)
  const already = (existingDomains ?? []).find((d) => d.name?.toLowerCase() === domain.toLowerCase())

  if (already) {
    console.log(`${label} custom domain already attached (status: ${already.status ?? 'unknown'})`)
  } else if (dryRun) {
    console.log(`${label} would attach custom domain ${domain}`)
  } else {
    await cf(token, `/accounts/${accountId}/pages/projects/${project}/domains`, {
      method: 'POST',
      body: JSON.stringify({ name: domain })
    })
    console.log(`${label} attached custom domain ${domain}`)
  }

  // 3. DNS. A CNAME at the hostname pointing at the project's pages.dev, proxied so
  //    Cloudflare terminates TLS and issues the certificate.
  const zoneName = zoneNameFor(domain)
  const zones = await cf(token, `/zones?name=${encodeURIComponent(zoneName)}`)
  const zone = (zones ?? [])[0]
  if (!zone) {
    throw new Error(
      `No zone "${zoneName}" on this account. The custom domain is attached but will not ` +
        `resolve until ${zoneName}'s nameservers point at Cloudflare, or until a CNAME ` +
        `${domain} → ${target} is created wherever its DNS is hosted.`
    )
  }

  const records = await cf(token, `/zones/${zone.id}/dns_records?name=${encodeURIComponent(domain)}`)
  const existing = (records ?? [])[0]

  if (!existing) {
    if (dryRun) {
      console.log(`${label} would create CNAME ${domain} → ${target} (proxied)`)
    } else {
      await cf(token, `/zones/${zone.id}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({ type: 'CNAME', name: domain, content: target, proxied: true })
      })
      console.log(`${label} created CNAME ${domain} → ${target} (proxied)`)
    }
  } else if (existing.type === 'CNAME' && existing.content === target && existing.proxied === true) {
    console.log(`${label} CNAME already correct (${domain} → ${target}, proxied)`)
  } else {
    // Something else holds the name. Repoint it rather than adding a second record,
    // which Cloudflare would reject anyway — but say what is being replaced, because
    // overwriting an unrelated record is the one destructive thing this script can do.
    console.log(
      `${label} existing ${existing.type} record at ${domain} → ${existing.content} ` +
        `(proxied: ${existing.proxied}) does not match; repointing`
    )
    if (dryRun) {
      console.log(`${label} would update record ${existing.id} to CNAME → ${target} (proxied)`)
    } else {
      await cf(token, `/zones/${zone.id}/dns_records/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ type: 'CNAME', name: domain, content: target, proxied: true })
      })
      console.log(`${label} updated CNAME ${domain} → ${target} (proxied)`)
    }
  }

  console.log(
    `${label} done. https://${domain} will serve once Cloudflare finishes issuing the ` +
      'certificate (usually under a minute, occasionally a few).'
  )
}

// Run only when invoked directly, so the pure helpers above stay unit-testable.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`[cf-domain] ${err.message}`)
    process.exit(1)
  })
}
