# EOD Radar

中文美股日终研究看板。行情唯一来源为长桥证券，代码列表维护在 src/lib/stocks.ts。

## 数据流

Longbridge CLI / 插件导出 → 整批校验 → Supabase PostgreSQL → 同一套指标计算 → 首页、详情、分享页、只读 API。

保留日K、成交量、MA50/100/200、RSI14、BOLL(20,2)、RVOL20、RV20与趋势评分。
页面及 API 只读取 provider=LONGBRIDGE 的行。旧来源及其分析模块已移除。
数据库旧表和旧字段为向后兼容暂时保留，不参与页面读取；不要在此清理中执行破坏性迁移。

## 初始化与更新

安装依赖并按 .env.example 配置数据库，安装可用的 longbridge CLI。
先执行 npm run db:generate，然后 npm run sync:bootstrap 拉取最多520根真实日线。
npm run sync:data 刷新最近30根日线；npm run backfill:longbridge 与首次完整采集共用入口。
采集器按纽约时间和美股交易日历选择完整收盘日；常规交易时段、价格前复权；最多4并发、连接故障最多重试2次。
所有代码校验通过后才进入数据库事务；任一股票缺失、日期未更新或OHLCV非法均拒绝导入。
数据库事务会一起更新全部股票与指标；失败回滚，sync_run保留失败记录。
运行 npm run audit:data 核对长桥覆盖、股票日期与指标日期。

插件输出也可以导入：npm run import:longbridge-plugin -- path/to/candles.json。
此入口与 CLI 共用校验及事务导入，格式为 adjustment=forward 和 series=[{symbol,candles}]。

## 执行环境

长桥 CLI 在安装它的本机或服务器运行；Vercel函数不执行CLI。
已移除原托管平台的旧行情定时拉取配置，防止继续调用废弃数据源。
使用现有本机任务调用 npm run sync:data；电脑必须保持唤醒和联网。
若迁移到常驻服务器，需要在该环境安装CLI并配置相应访问权限。
更新后页面缓存最多5分钟过期。POST /api/cron/sync 仅用于带 CRON_SECRET 的缓存刷新，不采集行情。

## 页面与 API

/ 首页：趋势分与RSI分布、紧凑清单、单选筛选和分数组成。
/stocks/CODE 详情：K线、均线/BOLL切换、成交量、近期强弱和计算口径。
/stocks/CODE/snapshot 简洁研究分享链接。
/api/v1/stocks 和 /api/v1/stocks/CODE/dashboard 为长桥数据派生的只读接口。
/api/health 核对长桥数据日期与覆盖；/debug 仅 ENABLE_DEBUG_PAGE=true 时开放。

## 验证

npm run typecheck
npm run lint
npm run test
npm run build

仅供研究，不构成投资建议。数据来源：长桥证券。
