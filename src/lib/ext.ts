const language_mapping: Record<string, string> = {
	go: "go",
	kt: "kotlin",
	java: "java",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsx: "javascript",
	ts: "typescript",
	tsx: "typescript",
	c: "c",
	cc: "c++",
	cxx: "c++",
	cpp: "c++",
	"c++": "c++",
	h: "c",
	hh: "c++",
	hxx: "c++",
	hpp: "c++",
	cs: "csharp",
	dart: "dart",
	erl: "erlang",
	hrl: "erlang",
	ex: "elixir",
	hs: "haskell",
	html: "html",
	htm: "html",
	css: "css",
	less: "less",
	scss: "scss",
	sass: "sass",
	lua: "lua",
	ml: "ocaml",
	php: "php",
	py: "python",
	ipynb: "python",
	rb: "ruby",
	rs: "rust",
	sh: "shell",
	ps1: "powershell",
	swift: "swift",
	md: "markdown",
	mdx: "markdown",
	markdown: "markdown",
	svelte: "svelte",
	vue: "vue",
	dockerfile: "docker",
	vbs: "vbscript",
	frm: "visualbasic",
	frx: "visualbasic",
	bas: "visualbasic",
	cls: "visualbasic",
	vb: "visualbasic",
	vba: "visualbasic",
	vbp: "visualbasic",
	vbw: "visualbasic",
	prisma: "prisma",
};

const type_mapping: Record<string, RegExp[]> = {
	test: [/.*\.test\..*$/i],
	docs: [/.*\.(md|mdx|markdown)/i],
	ci: [/^\.github\/workflows\/.*\.yml$/i, /^\.circleci\/config\.yml$/i, /^\.gitlab-ci\.yml$/i],
	code: [
		/.*\.(go|kt|java|js|mjs|cjs|jsx|ts|tsx|c|cc|cxx|cpp|c\+\+|h|hh|hxx|hpp|cs|dart|erl|hrl|ex|hs|html|htm|css|less|scss|sass|lua|ml|vbs|php|py|ipynb|rb|rs|sh|ps1|bat|cmd|prisma|swift|md|mdx|svelte|vue|dockerfile|frm|frx|bas|cls|vb|vba|vbp|vbw)$/i,
	],
	undefined: [
		/\.git.*$/i,
		/\..*?ignore$/i,
		/\..*?rc$/i,
		/\.mca$/i,
		/\.(lock|json|toml|yaml|yml|map)$/i,
		/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i,
		/\.(eot|ttf|woff|woff2|otf)$/i,
		/\.(mp3|m4a|mp4|webm|ogg|wav|midi|m3u8|mov)$/i,
		/\.(exe|bin|o|a|out|so|dll|lib|obj|jar|dat)$/i,
		/\.(zip|tar|rar|gz|7z|bz2|iso|dmg|npy|下載)$/i,
		/\.(txt|srt|vtt|log|csv|tsv|xml|pdf|doc|docx|xls|xlsx|ppt|pptx)#?$/i,
		/\.env.example$/i,
		/\.(DS_Store|clang-format|nojekyll|cargo-ok|replit)$/i,
		/^(.+\/)?[^/.]+$/,
	],
};

export const uncovereds = new Set<string>();

export function language(file: string): string {
	const ext = file.split("/").reverse()[0].split(".").pop()?.toLowerCase() || "";
	const lang = language_mapping[ext] || "unknown";

	return lang;
}

export function filetype(file: string): string | undefined {
	for (const [type, regexes] of Object.entries(type_mapping)) {
		for (const regex of regexes) {
			if (regex.test(file)) {
				if (type === "undefined") {
					return undefined;
				}
				return type;
			}
		}
	}

	uncovereds.add(file);
	return "unknown";
}
