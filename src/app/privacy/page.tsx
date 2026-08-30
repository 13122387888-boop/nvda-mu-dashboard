import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { SITE_CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "隐私说明",
  description: "收盘雷达邀请测试阶段的隐私与信息处理说明。",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="PRIVACY"
      title="隐私说明"
      intro="当前版本不要求注册账户，也不连接用户的券商账户。"
    >
      <section>
        <h2>当前不收集什么</h2>
        <p>本站当前不要求姓名、手机号、持仓、交易记录或支付信息，也不建立个性化投资档案。系统分享由设备或浏览器提供，本站不会读取你的微信联系人。</p>
      </section>
      <section>
        <h2>基础运行信息</h2>
        <p>托管、数据库和安全服务可能为了提供页面、防止滥用及排查故障而处理必要的网络日志，例如访问时间、IP 地址、设备和浏览器信息，并依照各自的隐私政策处理。</p>
      </section>
      <section>
        <h2>反馈邮件</h2>
        <p>主动发送反馈邮件时，我们只将邮件内容用于处理问题。请不要在邮件中发送账户密码、交易凭证或其他敏感信息。</p>
      </section>
      <section>
        <h2>后续更新</h2>
        <p>如果未来增加账户、访问统计或订阅功能，本说明会在启用前更新。隐私问题可联系 <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a>。</p>
      </section>
    </InfoPage>
  );
}

