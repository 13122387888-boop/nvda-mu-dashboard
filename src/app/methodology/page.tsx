import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
export const metadata: Metadata = {
  title: "数据与方法",
  description: "长桥日终行情及技术指标计算口径。",
};
export default function MethodologyPage() {
  return (
    <InfoPage
      eyebrow="DATA & METHODOLOGY"
      title="数据与方法"
      intro="页面使用长桥证券的美股常规时段、前复权日线。"
    >
      <section>
        <h2>唯一行情来源</h2>
        <p>
          开盘、最高、最低、收盘和成交量来自长桥。页面与公开接口只读取标记为长桥的数据；历史不足时明确显示样本不足，不用其他来源补数。成交量为源提供的成交量，前复权适用于价格。
        </p>
      </section>
      <section>
        <h2>更新时间</h2>
        <p>
          通过安装了长桥 CLI
          的采集环境执行日终更新，按美股交易日历选择已经完整收盘的交易日；网站显示实际入库日期。网站托管服务只负责读取数据库，数据日期不会因页面刷新自动前移。
        </p>
      </section>
      <section>
        <h2>技术指标</h2>
        <p>
          均线为最近50、100、200个交易日调整后收盘价的简单平均。RSI使用14日Wilder平滑；布林带使用20日均值和两倍总体标准差。相对成交量为当天成交量除以前20日平均成交量，至少需要10个有效历史样本。实际波动率使用20日对数收益率的样本标准差并按252个交易日年化。
        </p>
      </section>
      <section>
        <h2>趋势分组成</h2>
        <p>
          以50分为中性起点：均线位置最多±25分，均线排列±10分，RSI±10分，量价确认±5分；限制在0–100分。MA50/100/200分别占位置项5/8/12分；偏离达到12%/18%/25%时相应项封顶。至少需要两条可用均线；缺少某条均线时重新归一权重。RSI与量能缺失时对应项计0分。点击首页趋势分可查看各项贡献。
        </p>
      </section>
      <section>
        <h2>使用边界</h2>
        <p>
          布林带位置和成交量用于补充阅读价格结构；BOLL不直接加入趋势分。趋势分不是上涨概率。本文所有指标均为历史数据的统计描述，不构成投资建议。
        </p>
      </section>
    </InfoPage>
  );
}
