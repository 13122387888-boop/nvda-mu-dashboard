import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Footer, Header } from "./site-chrome";

describe("stock navigation", () => {
  it("renders the dotted BRK.B route and label in the selector", () => {
    const html = renderToStaticMarkup(createElement(Header));

    expect(html).toContain('href="/stocks/BRK.B"');
    expect(html).toContain("BRK.B");
    expect(html).toContain("伯克希尔 B");
  });

  it("uses the release brand and links to the product notes", () => {
    const header = renderToStaticMarkup(createElement(Header));
    const footer = renderToStaticMarkup(createElement(Footer));

    expect(header).toContain("收盘雷达");
    expect(header).toContain("EOD RADAR");
    expect(footer).toContain('href="/methodology"');
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/terms"');
    expect(footer).toContain("mailto:13122387888@163.com");
  });
});
