# OG artwork prompt

Reusable artwork instructions for page and post covers. Replace `{{TITLE}}` with
an actual title and supply `public/assets/images/site/favicon.png` as the identity
reference. Hardware and software versions below are fixed artwork text, not
repository runtime requirements. This prompt is independent of the site UI palette.

Generated assets are stored under `public/assets/images/og/`; page mappings live in
`src/data/og-pages.json` and are resolved by `src/lib/og.ts`. Review title readability,
portrait identity, crop, and contrast before replacing an asset. Do not put personal
or secret configuration in the prompt.

## Prompt

```text
Create a horizontal blog or site page preview image in a retro terminal style with an Arch Linux theme and vintage CRT monitor aesthetics. The image must feel like a carefully designed tech blog cover, not a full terminal screenshot. Use a black background, subtle scanlines, soft but brighter monochrome green phosphor glow, slight screen curvature, edge vignette, and nostalgic CRT texture. The terminal color palette should follow a bright monochrome green scheme: the title and key elements are more luminous, while secondary text is slightly dimmer, but the entire image must remain strictly monochrome green.

Use a hybrid layout that combines a 70/30 split-column structure with an L-shaped reading flow. The left 65–70% should function as the main information area, while the right 30–35% should serve as the portrait accent area. The composition should read like an L-shape: the title forms the top horizontal axis, the system info box beneath it forms the middle support, the portrait on the right acts as the vertical visual anchor, and a small terminal-style build-log area in the lower-left acts as the closing detail. Do not use an evenly scattered four-corner layout.

Render the page or article title directly as: "{{TITLE}}". Place it in the upper-left to upper-middle area. Use a larger, brighter, chunkier terminal headline style: a bold blocky monospace font with a strong pixel-phosphor feel, slightly filled with horizontal scanline texture. The title must be the dominant focal point. It may extend toward the center, but it must not intrude too far into the portrait area.

Directly beneath the title, place a terminal-style system information box surrounded by an ASCII-style border. The border should clearly feel character-based, not like a modern rounded UI card. Place this info box in the left-center area, not in a corner. Inside the box, use a two-column internal structure: on the left, place a small ASCII-style Arch Linux logo; on the right, place the device and system information. At the top of the right section, display the device name:
Haeward
Then separate it from the system fields with one full horizontal dashed line. Below that, show exactly:
OS: Arch Linux x86_64
Kernel: 6.19.12.arch1-1
CPU: AMD Ryzen 9 9950X3D (32) @ 5.76 GHz
GPU: NVIDIA GeForce RTX 4090 [Discrete]
Memory: 13.44 GiB / 64.00 GiB (21%)
Disk (/): 534.84 GiB / 972.43 GiB (55%)
Uptime: 23 days 14 hours 37 mins

Do not include a Time field anywhere in the system information box. Keep the information compact, realistic, and readable. The CPU and GPU must look like authentic Linux / fastfetch-style hardware lines rather than Apple Silicon branding. The OS line must explicitly include the architecture as x86_64.

In the upper-left area, include only 4 to 5 short boot log lines, with the versions fixed exactly as follows:
[  OK  ] Starting systemd 260.1-1
[  OK  ] Loading Linux 6.19.12.arch1-1
[  OK  ] Starting udevd 260.1-1
[  OK  ] Mounted root filesystem
[  OK  ] Reached default target
The upper-left boot log must not use any border, panel, or enclosing frame. It should appear as plain on-screen terminal text only. In addition to the boot log text, the upper-left region should have a subtle old-school terminal raised feel, like a slight convex, beveled, or embossed CRT terminal header area. This should be very subtle and should feel like old hardware screen structure, not a modern floating card.

In the lower-left area, remove the previous `ls` command block entirely. Do not show a shell prompt, do not show `ls`, and do not show a markdown filename. Instead, place a compact block of 4 to 5 short terminal-style blog build log lines as a decorative supporting element. These lines should feel authentic to a modern static-site or personal blog workflow, as if they were taken from a real build process. They should suggest content processing, page rendering, feed generation, search indexing, and successful build completion. The lines must stay short, believable, and visually restrained. They must not be enclosed in a border, and they must remain clearly secondary to the title and system info box.

Use concise terminal-style phrasing similar to the following, or something extremely close in tone and structure:
[INFO] Scanning content collection
[INFO] Rendering static pages
[INFO] Generating RSS feed
[INFO] Updating search index
[ OK ] Build completed successfully

Keep this lower-left block lightweight and realistic. It should resemble actual blog build output rather than generic status text. Avoid verbose package-manager output, deployment logs, timestamps, or dense multi-line debug output.

On the right side, place a clearly terminal-native ASCII portrait derived from the attached reference image `public/assets/images/site/favicon.png` (as shown in the figure). The portrait position must be fixed and must follow the layout reference closely. Anchor the portrait inside the right-side accent column, but keep it smaller and more restrained than before.

The portrait must be placed so that its top edge does not rise above the top border of the system information box. In other words, the highest visible point of the portrait must be aligned with or slightly below the y-level of the system information box’s top border. Do not allow the portrait to extend higher than that line.

Use this fixed placement constraint relative to the full canvas: the portrait should occupy a box roughly from 69% to 91% of the canvas width, and from 45% to 82% of the canvas height. Keep the portrait fully inside this box and do not move it to any other area. This placement is mandatory and should match the provided layout reference.

The portrait must remain visually separated from the title and the system information box, and it must not touch the canvas edges. Its scale must be reduced compared with previous results. The portrait should read as a secondary accent element, not a competing focal point.

Keep the portrait proportions natural and undistorted. Preserve the original aspect ratio of the character and cube silhouette from the reference image. Do not stretch it vertically or horizontally, do not make the head oversized, and do not enlarge the neck or shoulders unnaturally. Fit the portrait inside the specified bounding box using a “contain” behavior rather than filling the box aggressively.

The portrait must have a clearly terminal-native ASCII texture, built from dots, colons, plus signs, slashes, underscores, and similar glyphs. Make it distinctly terminal / ASCII, not semi-illustrated.

The portrait identity must be derived from the attached reference image `public/assets/images/site/favicon.png`. Use that image as the identity reference for the right-side portrait whenever reference images are supported. If reference images are not supported, do not invent a different face. Keep the character design consistent: a youthful, slightly androgynous anime-style person with pale skin and short dark navy-to-black hair, slightly tousled with a few loose strands. The face is shown in a calm side profile facing left and slightly upward, with closed eyes and a serene expression. The ear is clearly visible, the neck is slender, and only a small hint of a light-colored collar is visible. The most important identifying feature is that the head is enclosed in a transparent water-like cube, similar to a clear ice block or crystal cube, with refractive edges, fluid transparency, and a few droplets. ASCII is only the rendering method and must not redesign the character or change the direction, hairstyle, facial structure, expression, or cube silhouette.

The overall image must feel unified, balanced, low-density, and spacious. Maintain a clear hierarchy: title first, system info box second, portrait third, boot log and lower-left blog-build log lines as supporting atmospheric elements. The final result should feel like a premium geeky blog cover, not an interface collage or desktop screenshot.

Style keywords: retro terminal, Arch Linux, CRT screen, monochrome green phosphor, bright green terminal glow, headline-first composition, hybrid split-column plus L-shaped layout, ASCII border, authentic boot log, realistic static-site build log, subtle convex terminal header, minimal terminal UI, editorial tech blog cover.

Avoid: showing a Time field, using Apple M2 Pro or Apple-branded CPU/GPU lines, omitting the architecture from the OS line, using a shell prompt or `ls` command in the lower-left, showing markdown filenames, using a starship-style prompt, adding any border around the upper-left boot log, using vague generic status text in the lower-left instead of realistic blog build logs, modern rounded card UI, portraits whose top edge rises above the top border of the system information box, oversized portraits, distorted portrait proportions, vertically stretched faces, horizontally widened heads, portraits that dominate the composition, portrait touching the title, overly complex info panel, evenly scattered corner layout, too many terminal elements, full neofetch, dense logs, cyberpunk overload, blue-tinted or multicolor schemes.

Information to fill in:
TITLE = {{TITLE}}
```
