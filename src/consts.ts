import type { Metadata, Site, Socials } from "@types";

export const SITE: Site = {
    NAME: "Haeward",
    DESC: "Personal notes on software, reading, media, travel, and the small systems that shape everyday life.",
    NUM_POSTS_ON_HOMEPAGE: 10,
};

export const BLOG: Metadata = {
    TITLE: "Archive",
    DESCRIPTION:
        "A chronological archive of essays, notes, travelogues, and technical writing from Haeward.",
};

export const ABOUT: Metadata = {
    TITLE: "About",
    DESCRIPTION:
        "A brief introduction to Haeward, covering the person behind the site and ways to follow along.",
};

export const MEDIA: Metadata = {
    TITLE: "Media",
    DESCRIPTION: "A personal media shelf of books, films, series, anime, and notes worth keeping.",
};

export const BLOGROLL: Metadata = {
    TITLE: "Blogroll",
    DESCRIPTION: "Blogs I follow for ideas, stories, and new perspectives.",
};

export const CHANGELOG: Metadata = {
    TITLE: "Changelog",
    DESCRIPTION: "A running record of notable design, content, and technical updates to this site.",
};

export const SOCIALS: Socials = [
    {
        NAME: "Github",
        HREF: "https://github.com/haeward",
        ICON: "/assets/icons/social/github.svg",
        ENABLE: true,
    },
    {
        NAME: "Twitter",
        HREF: "https://x.com/haewardev",
        ICON: "/assets/icons/social/twitter.svg",
        ENABLE: true,
    },
    {
        NAME: "Mastodon",
        HREF: "https://g0v.social/@haeward",
        ICON: "/assets/icons/social/mastodon.svg",
        ENABLE: true,
    },
    {
        NAME: "Telegram",
        HREF: "https://t.me/haeward_til",
        ICON: "/assets/icons/social/telegram.svg",
        ENABLE: true,
    },
    {
        NAME: "Reddit",
        HREF: "https://www.reddit.com/user/haewardy",
        ICON: "/assets/icons/social/reddit.svg",
        ENABLE: false,
    },
    {
        NAME: "Instagram",
        HREF: "https://instagram.com/haewyu",
        ICON: "/assets/icons/social/instagram.svg",
        ENABLE: false,
    },
    {
        NAME: "YouTube",
        HREF: "https://youtube.com/@haewardev",
        ICON: "/assets/icons/social/youtube.svg",
        ENABLE: false,
    },
    {
        NAME: "Spotify",
        HREF: "https://open.spotify.com/user/31lkcldiugm7ppmax5ghzshgzfhy",
        ICON: "/assets/icons/social/spotify.svg",
        ENABLE: false,
    },
    {
        NAME: "Email",
        HREF: "mailto:me@haeward.com",
        ICON: "/assets/icons/social/email.svg",
        ENABLE: true,
    },
    {
        NAME: "RSS",
        HREF: "/rss.xml",
        ICON: "/assets/icons/social/rss.svg",
        ENABLE: true,
    },
];
