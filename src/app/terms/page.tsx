import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { SITE_CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "使用条款",
  description: "收盘雷达邀请测试阶段的使用范围与风险说明。",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="BETA TERMS"
      title="使用条款"
      intro="这是邀请测试版本。使用本站前，请先理解数据延迟和研究工具的边界。"
    >
      <section>
        <h2>仅供研究参考</h2>
        <p>页面展示的是历史和日终数据、统计指标与结构观察，不构成投资建议、收益承诺、交易指令或适合任何个人情况的推荐。投资决定及其结果由使用者自行承担。</p>
      </section>
      <section>
        <h2>不保证实时或完整</h2>
        <p>第三方数据可能出现延迟、缺失、修订或口径差异；模型和指标也可能因样本不足而不可用。请在作出重要决定前通过券商或交易所认可的来源核验。</p>
      </section>
      <section>
        <h2>第三方数据与内容</h2>
        <p>第三方数据和名称的权利归相应提供方所有。本站提供的是研究界面和派生解释，不授权用户批量抓取、转售或冒充官方行情服务。</p>
      </section>
      <section>
        <h2>测试期变更</h2>
        <p>邀请测试期间，股票范围、公式、数据源和页面功能可能调整。重大口径变化会尽可能在数据与方法页面说明。</p>
      </section>
      <section>
        <h2>联系</h2>
        <p>条款、数据或产品问题可联系 <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a>。</p>
      </section>
    </InfoPage>
  );
}
