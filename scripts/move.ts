import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const username = process.argv[2]?.toLowerCase();
if (!username) {
	console.error("Please provide a username");
	process.exit(1);
}

const dir = `data/${username}`;

if (!fs.existsSync(dir)) {
	const fetcher = spawn(`pnpm run fetch ${username}`, {
		shell: true,
		stdio: "inherit",
		env: process.env,
	});
	fetcher.on("close", (code) => {
		if (code === 0) {
			move();
		}
	});
} else {
	move();
}

function move() {
	if (!fs.existsSync("static/data")) {
		fs.mkdirSync("static/data", { recursive: true });
	}

	const files = fs.readdirSync(dir);
	for (const file of files) {
		const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
		fs.writeFileSync(path.join("static/data", file), JSON.stringify(data));
		console.log(`Moved ${path.join(dir, file)}`);
	}
}
