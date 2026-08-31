# Production health smoke

The `Production health smoke` workflow calls the public, read-only `/api/health`
endpoint at 07:15 UTC from Tuesday through Saturday. The production data sync is
scheduled for 05:30 UTC, and Vercel Hobby Cron can start anywhere within the
following one-hour window. The later smoke time leaves another 45 minutes for a
delayed sync to finish. It can also be run manually from the Actions page.

Configure **Settings → Secrets and variables → Actions → Variables** with:

- `PRODUCTION_BASE_URL`: the production origin, for example
  `https://eodradar.com` (no path required).

The URL is not sensitive, so a repository variable is preferred. A repository
secret with the same name is supported as a fallback. If neither is configured,
or the value is not an absolute HTTPS URL, the workflow fails with a clear setup
error rather than reporting a false success.

The smoke check fails on a non-200 response, invalid JSON, a health status other
than `ok`, a latest sync that was unsuccessful or not triggered by Cron, an old
or invalid completion time, or incomplete stock/metric/option date alignment.
Scheduled checks require a Cron completion within six hours; manual checks allow
24 hours. Enable GitHub Actions failure notifications for the repository so a
failed daily check is actionable.
