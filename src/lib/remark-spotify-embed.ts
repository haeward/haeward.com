import type { Html, Link, Paragraph, Root, Text } from "mdast";
import type { Parent } from "unist";
import { visit } from "unist-util-visit";

const SPOTIFY_MEDIA_TYPES = ["track", "album", "playlist", "artist", "show", "episode"] as const;

type SpotifyMediaType = (typeof SPOTIFY_MEDIA_TYPES)[number];

interface SpotifyData {
    type: SpotifyMediaType;
    id: string;
}

export function remarkSpotifyEmbed() {
    return (tree: Root) => {
        visit(
            tree,
            "paragraph",
            (node: Paragraph, index: number | undefined, parent: Parent | undefined) => {
                if (!parent || typeof index !== "number") return;

                if (node.children.length === 1 && node.children[0].type === "link") {
                    const link = node.children[0] as Link;
                    const url = link.url;
                    const spotifyData = extractSpotifyData(url);

                    if (spotifyData) {
                        const mediaNode: Html = {
                            type: "html",
                            value: generateSpotifyEmbed(spotifyData),
                        };

                        parent.children[index] = mediaNode;
                    }
                }

                if (node.children.length === 1 && node.children[0].type === "text") {
                    const text = (node.children[0] as Text).value.trim();
                    const mediaMatch = text.match(/^::media\[([^\]]+)\]$/);

                    if (mediaMatch) {
                        const url = mediaMatch[1];
                        const spotifyData = extractSpotifyData(url);

                        if (spotifyData) {
                            const mediaNode: Html = {
                                type: "html",
                                value: generateSpotifyEmbed(spotifyData),
                            };

                            parent.children[index] = mediaNode;
                        }
                    }
                }
            },
        );
    };
}

function generateSpotifyEmbed(spotifyData: SpotifyData): string {
    const height = getSpotifyHeight(spotifyData.type);

    return `<div class="media-embed spotify-embed">
    <iframe
      class="spotify-embed__frame"
      title="Spotify embedded player"
      src="https://open.spotify.com/embed/${spotifyData.type}/${spotifyData.id}?utm_source=generator"
      width="100%"
      height="${height}"
      frameBorder="0"
      allowfullscreen=""
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    ></iframe>
    <p><a href="https://open.spotify.com/${spotifyData.type}/${spotifyData.id}">Listen on Spotify</a></p>
  </div>`;
}

function extractSpotifyData(url: string): SpotifyData | undefined {
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();

        if (hostname !== "spotify.com" && !hostname.endsWith(".spotify.com")) {
            return undefined;
        }

        const [type, id] = parsedUrl.pathname.split("/").filter(Boolean);

        if (
            !["https:", "http:"].includes(parsedUrl.protocol) ||
            !isSpotifyMediaType(type) ||
            !id ||
            !/^[a-zA-Z0-9]+$/.test(id)
        ) {
            return undefined;
        }

        return { type, id };
    } catch {
        return undefined;
    }
}

function isSpotifyMediaType(type: string | undefined): type is SpotifyMediaType {
    return SPOTIFY_MEDIA_TYPES.includes(type as SpotifyMediaType);
}

function getSpotifyHeight(type: SpotifyMediaType): string {
    const heights: Record<SpotifyMediaType, string> = {
        track: "152",
        album: "352",
        playlist: "352",
        artist: "352",
        show: "232",
        episode: "232",
    };
    return heights[type];
}
