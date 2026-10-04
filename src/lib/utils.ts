export function readingTime(html: string) {
    // Remove script and style tags
    const withoutScriptAndStyle = html.replace(
        /<(script|style)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi,
        "",
    );

    // Remove all HTML tags
    const withoutTags = withoutScriptAndStyle.replace(/<[^>]+>/g, " ");

    // Decode HTML entities more comprehensively
    const decoded = withoutTags
        .replace(/&nbsp;/g, " ")
        .replace(/&[a-zA-Z0-9#]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!decoded) return "1 min read";

    // Count different language characters
    const cjkChars = (
        decoded.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []
    ).length;

    // Remove CJK and Thai/Lao/Khmer chars, then count space-separated words
    const withoutCJKThai = decoded.replace(
        /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u0e80-\u0eff\u1780-\u17ff]/g,
        " ",
    );
    const spaceSeperatedWords = withoutCJKThai
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length;

    let totalMinutes = 0;
    // CJK characters: ~300-400 characters per minute (using 350 as average)
    if (cjkChars > 0) {
        totalMinutes += cjkChars / 350;
    }
    // Space-separated languages: ~200-250 words per minute (using 225 as average)
    if (spaceSeperatedWords > 0) {
        totalMinutes += spaceSeperatedWords / 225;
    }

    const readingTimeMinutes = Math.max(1, Math.ceil(totalMinutes));
    return `${readingTimeMinutes} min read`;
}

export function wordCount(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return "0 words";

    // Count Chinese/Japanese characters (each character is considered a word)
    const cjkChars = (
        trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]/g) || []
    ).length;

    // Count English words (sequences of letters/numbers separated by spaces or punctuation)
    const englishWords = (trimmed.match(/[a-zA-Z0-9]+/g) || []).length;

    const totalWords = cjkChars + englishWords;
    return `${totalWords} words`;
}

export function visibleText(html: string): string {
    return html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, value: string) => {
            const number = value.toLowerCase().startsWith("x")
                ? Number.parseInt(value.slice(1), 16)
                : Number(value);
            return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : " ";
        })
        .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
