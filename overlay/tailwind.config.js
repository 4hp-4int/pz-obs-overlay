/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'neon-purple': '#a855f7',
                'neon-purple-dark': '#7e22ce',
            },
            backdropBlur: {
                'xs': '2px',
            },
        },
    },
    plugins: [],
} 