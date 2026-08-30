import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { SITE_CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "数据与方法",
  description: "收盘雷达的数据来源、更新时间、指标口径与使用边界。",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return (
    <InfoPage
      eyebrow="DATA & METHODOLOGY"
      title="数据与方法"
      intro="页面名称尽量简短，具体计算范围、数据限制和可以回答的问题统一在这里说明。"
    >
      <section>
        <h2>先看时间口径</h2>
        <p>本站整理的是美股市场日终数据，不是实时行情。股票、期权和派生指标分别标注数据日期；休市日或上游尚未发布时，页面会继续显示最近可用交易日。</p>
      </section>
      <section>
        <h2>股票数据</h2>
        <p>日线开高低收、复权价格与成交量主要来自 OnclickMedia；个别历史缺口使用长桥数据进行核验和补充。MA50、MA100、MA200、RSI14、BOLL(20,2)、相对成交量及趋势分均由本站根据已保存的日线重新计算。</p>
      </section>
      <section>
        <h2>期权数据</h2>
        <p>免费期权数据主要覆盖近平值的有限合约，并非券商完整期权链。看涨墙、看跌墙、未平仓量、最大痛点、Gamma、IV 百分位和预期区间都是基于页面可见样本的研究估算，因此可能与富途等完整链口径不同。</p>
      </section>
      <section>
        <h2>趋势分怎么理解</h2>
        <p>趋势分用于压缩价格与 MA50/100/200、RSI、BOLL 和成交量确认信息，方便同一观察池排序。它描述趋势结构强弱，不代表上涨概率，也不直接形成买入或卖出建议。</p>
      </section>
      <section>
        <h2>数据过期与纠错</h2>
        <p>当期权快照与最新股票日期不匹配时，相关结论应被视为历史快照或暂不可用。发现价格、日期或指标异常时，请发送邮件至 <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a>，并附上股票代码和页面日期。</p>
      </section>
    </InfoPage>
  );
}

