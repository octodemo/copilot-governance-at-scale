import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml } from "./ui/html.js";
import { inlineMarkdown, renderMarkdown, renderQuestion } from "./ui/markdown.js";

test("HTML escapes text and attributes, including token substitution", () => {
  assert.equal(escapeHtml('&<>"\''), "&amp;&lt;&gt;&quot;&#039;");
  assert.equal(escapeHtml(42), "42");
  assert.equal('<meta content="{{TOKEN}}">'.replace("{{TOKEN}}", escapeHtml('a"<b')), '<meta content="a&quot;&lt;b">');
});

test("Markdown renders safe external links and escapes raw markup and attribute payloads", () => {
  assert.equal(inlineMarkdown("**Bold** and *emphasis* and `<script>`"),
    "<strong>Bold</strong> and <em>emphasis</em> and <code>&lt;script&gt;</code>");
  const rendered = renderMarkdown('<img src=x onerror=alert(1)> [bad](javascript:alert) [data](data:text/html,bad) [safe](https://example.com/"onclick="bad)');
  assert.doesNotMatch(rendered, /<img|href="(?:javascript|data):| onclick=/);
  assert.match(rendered, /&lt;img/);
  assert.match(rendered, /href="https:\/\/example.com\/%22onclick=%22bad" target="_blank" rel="noopener noreferrer"/);
});

test("headings, lists and blockquotes preserve semantic structure and line endings", () => {
  for (let level = 1; level <= 6; level += 1) {
    assert.equal(renderMarkdown(`${"#".repeat(level)} **Title** <script>`),
      `<h${level} id="title-script"><strong>Title</strong> &lt;script&gt;</h${level}>`);
  }
  assert.equal(renderMarkdown("> A quote"), "<blockquote><p>A quote</p></blockquote>");
  assert.equal(renderMarkdown("3. Third\n4. Fourth"), '<ol start="3"><li>Third</li><li>Fourth</li></ol>');
  const source = "1. First\n   continuation\n\n   - Nested\n2. Second";
  const html = renderMarkdown(source);
  assert.match(html, /<ol><li><p>First continuation<\/p><ul><li>Nested<\/li><\/ul><\/li><li>Second<\/li><\/ol>/);
  assert.equal(renderMarkdown(source.replaceAll("\n", "\r\n")), html);
  assert.equal(renderMarkdown(""), "");
});

test("decision questions keep multi-block Markdown in the content instead of an inline headline", () => {
  const question = renderQuestion([
    "Choose the approach that fits your needs.",
    "",
    "- **Centralized** management",
    "- Local ownership",
    "",
    "> Consider the trade-offs before deciding.",
    "",
    "```json",
    '{"mode":"review"}',
    "```",
  ].join("\n"));

  assert.equal(question.singleParagraph, false);
  assert.match(question.html, /^<p>Choose the approach that fits your needs\.<\/p>/);
  assert.match(question.html, /<ul><li><strong>Centralized<\/strong> management<\/li><li>Local ownership<\/li><\/ul>/);
  assert.match(question.html, /<blockquote><p>Consider the trade-offs before deciding\.<\/p><\/blockquote>/);
  assert.match(question.html, /<pre class="markdown-code"><code class="language-json">/);
});

test("single-paragraph decision questions are suitable for the headline", () => {
  assert.deepEqual(renderQuestion("Choose **one** option."), {
    singleParagraph: true,
    html: "Choose <strong>one</strong> option.",
  });
});

test("all alert variants render formatted content without interpreting raw HTML", () => {
  for (const type of ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]) {
    for (const tag of ["script", "SCRIPT", "ScRiPt"]) {
      const html = renderMarkdown(`>   [!${type}]  \n> **Important** and \`code\`.\n>\n> <${tag}>alert(1)</${tag}>`);
      assert.match(html, new RegExp(`class="markdown-alert markdown-alert-${type.toLowerCase()}"`));
      assert.match(html, /role="note"/);
      assert.match(html, /<strong>Important<\/strong> and <code>code<\/code>/);
      assert.match(html, /&lt;script&gt;/i);
      assert.doesNotMatch(html, /<script>|\[!/i);
    }
  }
});

test("unknown alert markers remain ordinary blockquotes", () => {
  assert.equal(renderMarkdown("> [!DANGER]\n> Content"),
    "<blockquote><p>[!DANGER] Content</p></blockquote>");
});

test("tables retain alignment, escaped pipes, inline code and missing cells", () => {
  const html = renderMarkdown([
    "Intro", "| Option | Effort | Notes |", "| :--- | :---: | ---: |",
    "| **Central** | Low | `a|b` and a \\| pipe |",
    "| <script>alert(1)</script> | High |", "", "After"
  ].join("\n"));
  assert.match(html, /^<p>Intro<\/p><div class="table-wrap"><table>/);
  assert.match(html, /<th class="text-left">Option<\/th><th class="text-center">Effort<\/th><th class="text-right">Notes<\/th>/);
  assert.match(html, /<code>a\|b<\/code> and a \| pipe/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|\sstyle\s*=/i);
  assert.match(html, /<td class="text-right"><\/td>/);
  assert.match(html, /<\/table><\/div><p>After<\/p>$/);
  assert.equal(renderMarkdown("a | b\nnot a separator"), "<p>a | b not a separator</p>");
});

test("local anchors link to heading IDs without external-window attributes", () => {
  assert.equal(renderMarkdown("## Configure access\n\n[Return](#configure-access)"),
    '<h2 id="configure-access">Configure access</h2><p><a href="#configure-access">Return</a></p>');
});

test("profile links retain escaped template targets for safe in-place personalization", () => {
  const target = 'https://github.com/enterprises/{{enterprise.slug}} "fallback=https://github.com/enterprises"';
  const rendered = inlineMarkdown(`[Enterprise](${target})`);
  assert.match(rendered, /data-profile-link="https:\/\/github.com\/enterprises\/\{\{enterprise.slug\}\} &quot;fallback=https:\/\/github.com\/enterprises&quot;"/);
  assert.match(rendered, /href="https:\/\/github.com\/enterprises"/);
  assert.doesNotMatch(inlineMarkdown('[Bad](javascript:{{enterprise.slug}})'), /<a/);
});

test("fenced examples escape markup instead of interpreting headings, links or breaks", () => {
  const html = renderMarkdown("```html\n<script>alert(1)</script>\n## Example\n[link](https://example.com)\n***\n```\n\n***");
  assert.equal(html,
    '<pre class="markdown-code"><code class="language-html">&lt;script&gt;alert(1)&lt;/script&gt;\n## Example\n[link](https://example.com)\n***</code></pre><hr>');
  assert.doesNotMatch(html, /<script>|\sstyle\s*=/i);
});

test("JSON fences highlight tokens while preserving code and escaping every input segment", () => {
  const source = '{"model": "auto", "enabled": true, "limit": 12, "value": null}';
  const html = renderMarkdown("```json\n" + source + "\n```");
  assert.match(html, /class="language-json"/);
  assert.match(html, /class="syntax-key">&quot;model&quot;<\/span>/);
  assert.match(html, /class="syntax-string">&quot;auto&quot;<\/span>/);
  assert.match(html, /class="syntax-literal">true<\/span>/);
  assert.match(html, /class="syntax-number">12<\/span>/);
  assert.equal(html, '<pre class="markdown-code"><code class="language-json">{' +
    '<span class="syntax-key">&quot;model&quot;</span>: <span class="syntax-string">&quot;auto&quot;</span>, ' +
    '<span class="syntax-key">&quot;enabled&quot;</span>: <span class="syntax-literal">true</span>, ' +
    '<span class="syntax-key">&quot;limit&quot;</span>: <span class="syntax-number">12</span>, ' +
    '<span class="syntax-key">&quot;value&quot;</span>: <span class="syntax-literal">null</span>}' +
    '</code></pre>');
  for (const info of ['json', 'json" onclick="bad', 'unknown', '"><img']) {
    for (const tag of ["script", "SCRIPT", "ScRiPt"]) {
      const rendered = renderMarkdown("```" + info + `\n<${tag}>bad</${tag}>\n"<img>"\n` + "```");
      assert.doesNotMatch(rendered, /<script\b|<img\b|\sonclick\s*=/i);
      assert.match(rendered, /&lt;script&gt;/i);
    }
  }
});
