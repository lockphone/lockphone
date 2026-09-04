# 占住 / Lock Phone

An independent iOS focus app and bilingual public live dashboard.

> You don't always need to be productive. Sometimes your phone just needs to be quiet.
>
> 你不必一直高效，偶尔，也该让手机安静下来。

The complete product is open source so its public leaderboard rules can be inspected and verified.

## Public project

- Website: https://lockphone.app
- Source: https://github.com/lockphone/lockphone
- Contact: hello@lockphone.app
- X: https://x.com/lockphoneapp
- TikTok: https://www.tiktok.com/@lockphoneapp
- Reddit: https://www.reddit.com/user/lockphoneapp/

The source code is released under the [MIT License](LICENSE). Production scene
photography, ambient audio, and App Store screenshot uploads are intentionally
excluded: they are separately licensed media rather than source code. Their
provenance and attribution remain documented in
[`ios/Resources/ATTRIBUTION.md`](ios/Resources/ATTRIBUTION.md); they are not
relicensed by `LICENSE`.

Never commit a production `.env` file, Apple signing material, App Store
Connect keys, or user data. See [SECURITY.md](SECURITY.md) for reporting.

## Workspace

- `ios/` — SwiftUI iPhone app, Family Controls extensions, and Live Activity.
- `api/` — Fastify API, PostgreSQL persistence, OTP, sessions, leaderboard, and Apple sales importer.
- `web/` — Next.js public site in English (`/`) and Simplified Chinese (`/zh`).

The new services do not import or modify Coreader runtime code or data.

## GitHub workflow

GitHub is the canonical source of truth for this project. Start every work
session by fetching `origin` and fast-forwarding the local `main`; do new work
on a short-lived branch, merge it back into `main`, and push the resulting
commit before handing the project to another machine or agent.

```bash
git fetch --prune origin
git switch main
git pull --ff-only origin main
```

Do not copy `node_modules`, `.next`, `dist`, Xcode build products, or editor
state between machines. Reinstall dependencies from `package-lock.json` with
`npm ci`. Separately licensed production media and App Store screenshots are
transferred out of band and remain ignored by Git; keep their repository paths
unchanged after restoring them. Never commit `.env` files or signing material.
