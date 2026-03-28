/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				primary: "var(--color-primary)",
				"primary-foreground": "var(--color-primary-foreground)",
				secondary: "var(--color-secondary)",
				"secondary-foreground": "var(--color-secondary-foreground)",
				card: "var(--color-card)",
				hover: "var(--color-hover)",
				muted: "var(--color-muted)",
				accent: "var(--color-accent)",
				"accent-hover": "var(--color-accent-hover)",
				border: "var(--color-border)",
				destructive: "var(--color-destructive)",
				warning: "var(--color-warning)",
				info: "var(--color-info)",
				success: "var(--color-success)",
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
				mono: ["IBM Plex Mono", "JetBrains Mono", "monospace"],
			},
		},
	},
	plugins: [],
};
