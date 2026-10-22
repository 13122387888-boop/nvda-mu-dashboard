# Production health

The GitHub workflow is a read-only check, not a data collector.
Configure PRODUCTION_BASE_URL. It checks /api/health for Longbridge-only source,
complete symbol coverage and freshness. The scheduled check is at 09:30 Asia/Shanghai
Tuesday through Saturday. Collection itself runs in the configured Longbridge environment.
