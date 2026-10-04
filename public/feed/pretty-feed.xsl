<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
  version="1.0"
>
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title><xsl:value-of select="rss/channel/title"/> | RSS Feed</title>
        <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/site/favicon-32.png"/>
        <style><![CDATA[
          @font-face {
            font-family: "LXGW Neo XiHei";
            src: url("/assets/fonts/LXGWNeoXiHei.ttf") format("truetype");
            font-weight: 700;
            font-style: normal;
            font-display: swap;
          }

          @font-face {
            font-family: "JetBrains Mono";
            src: url("/assets/fonts/JetBrainsMono-Regular.ttf") format("truetype");
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }

          @font-face {
            font-family: "JetBrains Mono";
            src: url("/assets/fonts/JetBrainsMono-Bold.ttf") format("truetype");
            font-weight: 700;
            font-style: normal;
            font-display: swap;
          }

          :root {
            color-scheme: light;
            --bg-base: #FFC34A;
            --hud-red: #df3326;
            --coin-yellow: #ffc93c;
            --coin-yellow-shadow: #efab00;
            --brick: #b8692e;
            --brick-shadow: #8d4617;
            --cream: #fff9ec;
            --panel: #fffdf7;
            --ink: #19120f;
            --muted: #5e554d;
            --line: #231915;
            --line-soft: rgba(35, 25, 21, 0.2);
            --shadow: 0 7px 0 rgba(25, 18, 15, 0.96);
            --link-red: #cf3825;
            --link-red-hover: #a82618;
          }

          * {
            box-sizing: border-box;
          }

          ::selection {
            background: var(--line);
            color: var(--coin-yellow);
          }

          html,
          body {
            margin: 0;
            padding: 0;
            min-height: 100%;
          }

          body {
            position: relative;
            min-height: 100vh;
            font-family: "LXGW Neo XiHei", sans-serif;
            color: var(--ink);
            background-color: var(--bg-base);
            line-height: 1.6;
          }

          body::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 0;
            background-image: url("/feed/pokeball-pattern.svg");
            background-size: 104px 104px;
          }

          a {
            text-underline-offset: 0.2em;
          }

          :is(a, button):focus-visible {
            outline: 2px solid var(--link-red-hover);
            outline-offset: 4px;
          }

          .page {
            max-width: 44rem;
            margin: 0 auto;
            padding: 2rem 1rem 3rem;
          }

          .masthead {
            position: relative;
            z-index: 1;
            margin-bottom: 1.9rem;
          }

          .layout {
            position: relative;
            padding-top: 0.2rem;
          }

          .panel {
            position: relative;
            z-index: 1;
            border: 3px solid var(--line);
            border-radius: 28px;
            background: var(--panel);
            box-shadow: var(--shadow);
            padding: 1.6rem 1.7rem;
          }

          .panel--hero {
            min-height: 8.75rem;
            padding: 1.2rem 1.45rem;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .hero-head {
            margin-bottom: 1.2rem;
            padding: 0 0 1rem;
            border-bottom: 3px solid var(--line);
            box-shadow: inset 0 -7px 0 rgba(255, 201, 60, 0.18);
          }

          .panel + .panel {
            margin-top: 2.4rem;
          }

          .back-link {
            display: inline-flex;
            align-items: center;
            gap: 0.55rem;
            min-height: 44px;
            margin-bottom: 1.15rem;
            color: var(--ink);
            font-family: "JetBrains Mono", monospace;
            font-size: 0.8rem;
            font-weight: 700;
            text-decoration: none;
            letter-spacing: 0.03em;
            opacity: 0.92;
            transition: color 180ms ease, opacity 180ms ease, transform 180ms ease;
          }

          .back-link:hover {
            color: #100b08;
            opacity: 1;
            transform: translateX(2px);
          }

          .back-link:hover .back-link__text {
            text-decoration: underline;
          }

          .back-link__icon {
            width: 1.5rem;
            height: 1.5rem;
            display: inline-grid;
            place-items: center;
            border: 2px solid var(--line);
            border-radius: 999px;
            background: var(--coin-yellow);
            line-height: 1;
            transition: background-color 180ms ease, border-color 180ms ease;
          }

          .back-link:hover .back-link__icon {
            background: #ffd96a;
            border-color: #1a120d;
          }

          h1 {
            margin: 0;
            font-size: clamp(1.5rem, 3vw, 2rem);
            line-height: 1.1;
          }

          .intro {
            margin: 0;
            max-width: 44rem;
            color: #4d443d;
            font-size: 0.92rem;
            padding-left: 1.4rem;
          }

          .intro p {
            margin: 0 0 0.8rem;
          }

          .intro a {
            color: inherit;
            font-weight: 700;
          }

          .feed-field-label,
          .section-title {
            display: block;
            margin-bottom: 0.55rem;
            font-family: "JetBrains Mono", monospace;
            font-size: 0.82rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .feed-copy {
            width: 100%;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            text-align: left;
            border: 2px solid var(--line);
            border-radius: 18px;
            background: #fff2b7;
            color: var(--ink);
            padding: 0.68rem 0.85rem;
            font-family: "JetBrains Mono", monospace;
            font-size: 0.9rem;
            box-shadow: inset 0 -4px 0 rgba(239, 171, 0, 0.26);
            cursor: pointer;
            transition: transform 160ms ease, border-color 160ms ease, background-color 160ms ease;
          }

          .feed-copy:hover {
            transform: translateY(-1px);
            border-color: #1a120d;
            background: #ffe992;
          }

          .feed-copy:focus-visible {
            outline: 2px solid var(--link-red-hover);
            outline-offset: 3px;
          }

          .feed-copy__value {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .feed-copy__meta {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            gap: 0.65rem;
            font-size: 0.78rem;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .feed-copy__hint {
            display: none;
          }

          .feed-copy__status {
            display: none;
            color: var(--link-red);
            font-weight: 700;
          }

          .feed-copy.is-copied .feed-copy__status {
            display: inline;
          }

          .feed-copy.is-copied .feed-copy__hint {
            display: none;
          }

          .feed-copy-help {
            margin: 0.55rem 0 0;
            color: var(--muted);
            font-size: 0.82rem;
          }

          .section-header {
            margin-bottom: 0.7rem;
            padding: 0 0 0.65rem;
            border-bottom: 3px solid var(--line);
            box-shadow: inset 0 -7px 0 rgba(255, 201, 60, 0.18);
          }

          .recent-list {
            list-style: none;
            margin: 0;
            padding: 0;
          }

          .recent-item {
            padding: 0.65rem 0.15rem 0.65rem 0.1rem;
            border-top: 2px solid var(--line-soft);
          }

          .recent-item:first-child {
            border-top: none;
            padding-top: 0.35rem;
          }

          .recent-item__title {
            margin: 0 0 0.12rem;
            font-size: 1rem;
            line-height: 1.45;
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          .recent-item__title a {
            color: var(--link-red);
            text-decoration: none;
            font-weight: 700;
          }

          .recent-item__title a:hover {
            text-decoration: underline;
            color: var(--link-red-hover);
          }

          .recent-item__date {
            margin: 0;
            display: flex;
            flex-wrap: wrap;
            line-height: 1.4;
            align-items: baseline;
            gap: 0.45rem;
            font-family: "JetBrains Mono", monospace;
            font-size: 0.8rem;
            color: var(--muted);
            letter-spacing: 0.05em;
          }

          .recent-item__date-label {
            font-size: 0.72rem;
            color: #80756b;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              transition: none !important;
              transform: none !important;
            }
          }

          @media (max-width: 720px) {
            .page {
              padding: 1.25rem 0.85rem 2.5rem;
            }

            .panel {
              box-shadow: 0 6px 0 rgba(25, 18, 15, 0.94);
            }

            .feed-copy {
              align-items: flex-start;
              flex-direction: column;
            }

            .feed-copy__meta {
              width: 100%;
              justify-content: space-between;
            }
          }
        ]]></style>
        <script><![CDATA[
          function getBrowserFeedUrl() {
            if (window.location && window.location.href) {
              return window.location.href;
            }

            return "";
          }

          function hydratePrettyFeed() {
            const backLink = document.getElementById("back-link");
            const backText = document.getElementById("back-link-host");
            const feedCopy = document.getElementById("feed-copy");
            const feedValue = document.getElementById("feed-copy-value");
            const browserFeedUrl = getBrowserFeedUrl();

            if (backLink) {
              backLink.setAttribute("href", "/");
            }

            if (backText && window.location && window.location.host) {
              backText.textContent = window.location.host;
            }

            if (feedCopy && browserFeedUrl) {
              feedCopy.setAttribute("data-copy", browserFeedUrl);
            }

            if (feedValue && browserFeedUrl) {
              feedValue.textContent = browserFeedUrl;
            }
          }

          function copyFeedAddress(button) {
            if (!button) return;

            const value = button.getAttribute("data-copy") || "";
            if (!value) return;

            const setCopiedState = () => {
              document.getElementById("feed-copy-help").textContent = "Feed address copied.";
              button.classList.add("is-copied");
              window.clearTimeout(button._copyTimer);
              button._copyTimer = window.setTimeout(() => {
                button.classList.remove("is-copied");
              }, 1800);
            };

            const fallbackCopy = () => {
              const input = document.createElement("input");
              input.value = value;
              document.body.appendChild(input);
              input.select();
              let copied = false;
              try { copied = document.execCommand("copy"); } catch { /* Manual copying remains available. */ }
              document.body.removeChild(input);
              button.focus();
              if (copied) setCopiedState();
              else {
                button.classList.remove("is-copied");
                document.getElementById("feed-copy-help").textContent = "Could not copy. Select the address or copy it from your browser’s address bar.";
              }
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(value).then(setCopiedState).catch(fallbackCopy);
              return;
            }

            fallbackCopy();
          }

          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", hydratePrettyFeed);
          } else {
            hydratePrettyFeed();
          }
        ]]></script>
      </head>
      <body>
        <div class="page">
          <div class="masthead">
            <a class="back-link" href="/" id="back-link">
              <span class="back-link__icon">&#8592;</span>
              <span class="back-link__text">Back to <span id="back-link-host"><xsl:value-of select="substring-before(substring-after(rss/channel/link, '//'), '/')"/></span></span>
            </a>

            <div class="intro">
              <p><b>This is a web feed</b> (RSS), also known as an RSS feed. Subscribe by copying the URL from the address bar into your newsreader.</p>
              <p>Visit <a href="https://aboutfeeds.com/">About Feeds</a> to get started with newsreaders and subscribing. It’s free.</p>
            </div>
          </div>

          <div class="layout">
            <div class="panel panel--hero">
              <div class="hero-head">
                <h1><xsl:value-of select="rss/channel/title"/></h1>
              </div>

              <div>
                <span class="feed-field-label">Feed Address</span>
                <button class="feed-copy" type="button" onclick="copyFeedAddress(this)" id="feed-copy">
                  <xsl:attribute name="data-copy"><xsl:value-of select="rss/channel/atom:link[@rel='self']/@href"/></xsl:attribute>
                  <span class="feed-copy__value" id="feed-copy-value"><xsl:value-of select="rss/channel/atom:link[@rel='self']/@href"/></span>
                  <span class="feed-copy__meta">
                    <span class="feed-copy__status">Copied</span>
                  </span>
                </button>
                <p class="feed-copy-help" id="feed-copy-help" role="status">Click the feed address box to copy the RSS URL.</p>
              </div>
            </div>

            <div class="panel">
              <div class="section-header">
                <span class="section-title">Recent Posts</span>
              </div>
              <ol class="recent-list">
                <xsl:for-each select="rss/channel/item">
                  <li class="recent-item">
                    <p class="recent-item__title">
                      <a>
                        <xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
                        <xsl:value-of select="title"/>
                      </a>
                    </p>
                    <p class="recent-item__date">
                      <span class="recent-item__date-label">Published:</span>
                      <span><xsl:value-of select="concat(substring(pubDate, 1, 5), substring(pubDate, 6, 11))"/></span>
                    </p>
                  </li>
                </xsl:for-each>
              </ol>
            </div>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
