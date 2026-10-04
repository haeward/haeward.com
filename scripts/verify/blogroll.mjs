import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeBlogUrl, parseBlogroll } from "../../src/lib/blogroll.ts";
import { blogrollPeriod, orderBlogroll } from "../../src/lib/blogroll-order.ts";

const opml = (body) => `<?xml version="1.0"?><opml version="2.0"><body>${body}</body></opml>`;
const parse = (body) => parseBlogroll(opml(body));
assert.deepEqual(
    parse(`
    <outline text="Blogs"><outline title="Nested">
        <outline text="Lofi&apos;Log &amp; 中文 &#x2605;" htmlUrl="https://example.com/blog/"/>
        <outline title="123" xmlUrl="https://other.example/zh/atom.xml"/>
    </outline></outline>
    <outline text="Duplicate" htmlUrl="https://example.com/blog"/>
    <outline text="Podcasts"><outline text="Audio" htmlUrl="https://audio.example/"/></outline>
    <outline text="Video" type="video" htmlUrl="https://video.example/"/>
    <outline text="Channel" xmlUrl="https://www.youtube.com/feeds/videos.xml?channel_id=123"/>
`),
    [
        { name: "Lofi'Log & 中文 ★", url: "https://example.com/blog/" },
        { name: "123", url: "https://other.example/zh/" },
    ],
);
for (const endpoint of [
    "feed",
    "rss",
    "rss2.xml",
    "feed.atom",
    "atom.xml",
    "index.xml",
    "feed.json",
]) {
    assert.equal(
        parse(`<outline text="Blog" xmlUrl="https://example.com/blog/${endpoint}"/>`)[0].url,
        "https://example.com/blog/",
    );
}
assert.deepEqual(parse(""), []);
assert.deepEqual(parse('<outline text="Empty group"/>'), []);
for (const malformed of [
    "<opml><body></opml>",
    "<opml><body>",
    '<opml><body><outline text="Unclosed/></body></opml>',
    '<opml><body><outline text="First" text="Duplicate"/></body></opml>',
    "<opml><body/></opml><opml><body/></opml>",
]) {
    assert.throws(() => parseBlogroll(malformed), /invalid OPML/);
}
assert.throws(() => parseBlogroll("<rss/>"), /expected an opml/);
assert.throws(() => parse('<outline text="Bad" htmlUrl="javascript:alert(1)"/>'), /HTTP\(S\)/);
const credentialUrl = new URL("https://example.com");
credentialUrl.username = "fixture";
assert.throws(() => parse(`<outline text="Bad" htmlUrl="${credentialUrl.href}"/>`), /credentials/);
assert.equal(
    parse('<outline text="Proxy" xmlUrl="https://feeds.example.com/opaque-id"/>')[0].url,
    "https://feeds.example.com/",
);
assert.throws(() => parse('<outline htmlUrl="https://example.com"/>'), /needs text or title/);
assert.throws(
    () => parseBlogroll('<!DOCTYPE opml [<!ENTITY x "test">]><opml><body/></opml>'),
    /DTD/,
);
// Parse anew on each invocation: replacing the export must not retain a previous list.
assert.equal(parse('<outline text="Before" htmlUrl="https://before.example/"/>')[0].name, "Before");
assert.equal(parse('<outline text="After" htmlUrl="https://after.example/"/>')[0].name, "After");
const current = parseBlogroll(readFileSync("public/subscriptions.opml", "utf8"));
assert.equal(new Set(current.map((blog) => blog.url)).size, current.length);
console.log(`Blogroll parser regressions passed; current export contains ${current.length} blogs.`);

// Daily order changes with the UTC calendar date and stays timezone-independent.
assert.equal(blogrollPeriod(new Date("2026-09-21T00:00:00Z")), "2026-09-21");
assert.equal(blogrollPeriod(new Date("2026-09-21T23:59:59Z")), "2026-09-21");
assert.equal(blogrollPeriod(new Date("2026-09-22T00:00:00Z")), "2026-09-22");
assert.equal(blogrollPeriod(new Date("2026-09-22T07:59:59+08:00")), "2026-09-21");
assert.equal(blogrollPeriod(new Date("2027-01-01T00:00:00Z")), "2027-01-01");
const sample = Array.from({ length: 20 }, (_, i) => ({
    name: `Blog ${i}`,
    url: `https://blog${i}.example/`,
}));
const snapshot = structuredClone(sample);
const day = orderBlogroll(sample, "2026-09-21");
assert.deepEqual(orderBlogroll(sample, "2026-09-21"), day);
assert.deepEqual(orderBlogroll([...sample].reverse(), "2026-09-21"), day);
assert.notDeepEqual(orderBlogroll(sample, "2026-09-22"), day);
assert.deepEqual(new Set(day.map((blog) => blog.url)), new Set(sample.map((blog) => blog.url)));
assert.deepEqual(sample, snapshot);
assert.deepEqual(orderBlogroll([], "2026-09-21"), []);
assert.deepEqual(orderBlogroll(sample.slice(0, 1), "2026-09-21"), sample.slice(0, 1));
assert.equal(
    normalizeBlogUrl("https://www.example.com/zh/posts/?utm_source=rss#feed"),
    "https://www.example.com/zh/",
);
assert.equal(
    normalizeBlogUrl("https://example.com/?gclid=abc&utm_medium=email&keep=yes"),
    "https://example.com/?keep=yes",
);
assert.equal(normalizeBlogUrl("https://example.com/atom.xml", true), "https://example.com/");
assert.equal(
    normalizeBlogUrl("https://example.com/zh/posts/feed.xml", true),
    "https://example.com/zh/",
);
console.log("Blogroll daily ordering and URL normalization regressions passed.");
