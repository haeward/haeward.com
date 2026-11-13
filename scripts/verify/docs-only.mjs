// Fail closed: only known documentation paths may skip the site checks.
let input = "";
for await (const chunk of process.stdin) input += chunk;
const files = input.trim().split("\n").filter(Boolean);
process.exitCode =
    files.length > 0 &&
    files.every((file) => /^(README\.md|AGENTS\.md|DESIGN\.md|docs\/.*)$/.test(file))
        ? 0
        : 1;
