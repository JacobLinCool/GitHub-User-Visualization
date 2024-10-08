import { sveltekit } from "@sveltejs/kit/vite";

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	worker: {
		// @ts-expect-error
		plugins: [sveltekit()],
		format: 'es',
	},
	test: {
		include: ["src/**/*.{test,spec}.{js,ts}"],
	},
	server: {
		host: "0.0.0.0",
	},
	define: {
		BUILD_TIMESTAMP: JSON.stringify(new Date().toISOString()),
	},
};

export default config;
