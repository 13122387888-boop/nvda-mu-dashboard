import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Header } from "./site-chrome";

describe("stock navigation", () => {
  it("renders the dotted BRK.B route and label in the selector", () => {
    const html = renderToStaticMarkup(createElement(Header));

    expect(html).toContain('href="/stocks/BRK.B"');
    expect(html).toContain("BRK.B");
    expect(html).toContain("伯克希尔 B");
  });
});
