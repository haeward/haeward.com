import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    theme: {
        extend: {
            fontFamily: {
                sans: defaultTheme.fontFamily.sans,
                serif: defaultTheme.fontFamily.sans,
                mono: defaultTheme.fontFamily.mono,
            },
        },
    },
};
