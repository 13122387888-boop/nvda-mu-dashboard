# Production health smoke

The `Production health smoke` workflow calls the public, read-only `/api/health`
endpoint at 06:15 UTC from Tuesday through Saturday, after the 05:30 UTC data
sync. It can also be run manually from the Actions page.

Configure **Settings → Secrets and variables → Actions → Variables** with:

- `PRODUCTION_BASE_URL`: the production origin, for example
  `https://eod-radar.vercel.app` (no path required).

The URL is not sensitive, so a repository variable is preferred. A repository
secret with the same name is supported as a fallback. If neither is configured,
or the value is not an absolute HTTPS URL, the workflow fails with a clear setup
error rather than reporting a false success.

The smoke check fails on a non-200 response, invalid JSON, a health status other
than `ok`, an unsuccessful latest sync, or incomplete stock/metric/option date
alignment. Enable GitHub Actions failure notifications for the repository so a
failed daily check is actionable.
