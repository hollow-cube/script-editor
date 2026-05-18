# Preview & environment deployments — technical notes

> Location may change later. This is the durable home for _why_ the deployment
> topology looks the way it does; `.github/CONTRIBUTING.md` has the
> contributor-facing summary.

## One artifact, runtime host-derived API base

The web app is built **once**. It does not bake in an API URL. At load,
`web/src/api-base.ts` maps `window.location.hostname` to an API origin:

| Hostname                                   | API base                     |
| ------------------------------------------ | ---------------------------- |
| `localhost` / `127.0.0.1`                  | `http://localhost:10000`     |
| `local.hollowcube.dev`                     | `http://localhost:10000`     |
| `hollowcube.net` (production)              | `https://api.hollowcube.net` |
| `script-editor-<n>.preview.hollowcube.dev` | `https://api.hollowcube.net` |
| anything else                              | **throws at load**           |

That map _is_ the whitelist — there is no `?api=` override and no `.env`
fallback, so there is no untrusted input and no silent fallback to the real API.
Previews intentionally share the production API for now; this may become a
dedicated staging URL later (single edit in `api-base.ts`).

The `/editor` prefix-stripping Worker (`web/worker/index.ts`) is host-agnostic
and reused unchanged for every deployment — only the Worker `name` and its
domain/route differ per target.

## Why per-PR Workers, not `wrangler versions upload`

The native "versions / preview URL" mechanism is simpler (one Worker, no extra
routes/DNS, nothing to tear down) but its preview URL is always
`*.workers.dev` — Cloudflare cannot bind a custom hostname to a _non-production
version_ of a Worker. We require per-PR previews **on `hollowcube.dev`** so that
`api.hollowcube.net` can CORS-allowlist a domain we own rather than all of
`*.workers.dev` (a shared, multi-tenant domain). Custom hostname + per-PR
isolation ⇒ one Worker + one Workers **custom domain** per PR. Custom domains
(rather than routes) were chosen so Cloudflare auto-provisions the DNS record
and an edge cert per hostname — no wildcard DNS record and no Advanced
Certificate Manager (Universal SSL does not cover `*.preview.hollowcube.dev`,
which is two labels deep).

Cost: **not** dollar-expensive — Workers bill per request, not per script, and
each preview Worker (with its custom domain, DNS, and cert) is deleted when its
PR closes. The only overhead is the per-PR Worker and the teardown workflow.

## Workflow mechanics

- **`preview-web.yml`** — `pull_request` (opened/synchronize/reopened). Runs the
  reusable `ci.yml` as a blocking gate, then builds and deploys. `custom_domain`
  has no deploy flag, so the step `jq`-patches the plugin-generated
  `dist/*/wrangler.json` in place (same dir, so its relative `main`/`assets`
  paths still resolve) to set `name = script-editor-pr-<N>` and
  `routes = [{ pattern: script-editor-<N>.preview.hollowcube.dev,
custom_domain: true }]`, then `wrangler deploy -c` that config. Upserts a
  sticky PR comment (header `web-preview`). Cancellable concurrency per PR.
- **`preview-web-cleanup.yml`** — `pull_request` (closed). Separate workflow
  with a **non-cancelling** concurrency group so teardown is never cancelled by
  a superseding build. Runs `wrangler delete --name script-editor-pr-<N>`,
  which cascades: the custom domain, its auto-created DNS record, and the edge
  cert are all removed. Updates the comment.
- **`deploy-web.yml`** — push to `main`. `deploy` publishes production
  (`script-editor`, route bound out-of-repo on `hollowcube.net/editor/*`);
  `deploy-local` patches the config the same way to publish the persistent
  `script-editor-local` as the `local.hollowcube.dev` custom domain. Same
  artifact, different name/domain.

All jobs reuse the Vault → Cloudflare-creds pattern
(`hollow-cube/actions/secrets@main`, `path: global/github` exposing
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`).

## Out-of-repo prerequisites (operator)

- `hollowcube.dev` is a Cloudflare zone on the same account as
  `CLOUDFLARE_ACCOUNT_ID`.
- **No manual DNS and no ACM.** Custom domains make Cloudflare auto-create the
  proxied DNS record and a managed edge cert for each exact hostname
  (`script-editor-<n>.preview.hollowcube.dev`, `local.hollowcube.dev`) on
  deploy, and remove them on `wrangler delete`. Nothing to pre-create.
- Production route `hollowcube.net/editor/*` bound to `script-editor` (managed
  out-of-repo; production keeps its existing route, not a custom domain).
- Cloudflare API token scopes: Account → Workers Scripts: Edit; **Zone → DNS:
  Edit on `hollowcube.dev`** (custom domains create DNS records — this is new
  vs. the route-based setup); Zone → Workers Routes: Edit on `hollowcube.dev`
  and `hollowcube.net`; Account → Account Settings: Read. (Same token covers
  `wrangler delete` and the cascade.)

## Known risk: `local.hollowcube.dev` → `http://localhost:10000`

The page is served over HTTPS (secure context — `crypto.subtle`/DPoP fine) but
calls `http://localhost:10000`. This is **not** classic mixed content
(`http://localhost` is "potentially trustworthy"), but for it to actually work
the **local backend** must answer Private Network Access preflights with
`Access-Control-Allow-Private-Network: true`, send CORS for origin
`https://local.hollowcube.dev`, and accept DPoP `htu=http://localhost:10000/...`
(the client already derives `htu` from the absolute request URL — no client
change). PNA enforcement varies by browser/version. This is a backend + browser
concern, not solvable in this repo. Sturdier fallback if PNA proves unreliable:
run the local backend behind a Cloudflare Tunnel and remap
`local.hollowcube.dev` to the tunnel URL in `api-base.ts`.
