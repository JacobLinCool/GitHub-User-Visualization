import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { Octokit } from "octokit";
import type { Ora } from "ora";
import { Pool } from "@jacoblincool/puddle";

config();

const CACHE_TIME = Number(process.env.CACHE_TIME) || 1000 * 60 * 60;

const dir = path.resolve("data/_github");

if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir, { recursive: true });
}

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function graph(
	username: string,
	spinner?: Ora,
): Promise<{
	user: { name: string; company: string; avatar: string; created: string; url: string };
	repos: { name: string; description: string }[];
	issues: Record<
		string,
		{ title: string; created: string; number: number; participants: string[] }[]
	>;
}> {
	const max = 100;
	let anchor = new Date();
	let created = new Date(0);

	const repos = new Map<
		string,
		{
			name: string;
			description: string;
			issues: { title: string; created: string; number: number; participants: string[] }[];
		}
	>();

	const user: { name: string; company: string; avatar: string; created: string; url: string } = {
		name: "",
		company: "",
		avatar: "",
		created: "",
		url: "",
	};

	const cachefile = path.join(dir, `${username}.json`);
	const skip = fs.existsSync(cachefile) && Date.now() - fs.statSync(cachefile).mtimeMs < CACHE_TIME;

	if (skip) {
		spinner?.info("Using cached GitHub data");
		const data = JSON.parse(fs.readFileSync(cachefile, "utf-8"));
		Object.assign(user, data.user);
		for (const repo of data.repos) {
			repos.set(repo.name, repo);
		}
	} else {
		spinner?.start("Fetching data from GitHub");

		const issue_repos = new Set<string>();
		while (anchor > created) {
			const to = new Date(anchor);
			const from = new Date(anchor.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
			if (spinner) {
				spinner.text = `Fetching data from ${from.toDateString()} to ${to.toDateString()}`;
			}

			const result = (await octokit.graphql(query_meta(), {
				username,
				from,
				to,
				max,
			})) as MetaResult;

			Object.assign(user, {
				name: result.user.name,
				company: result.user.company,
				avatar: result.user.avatar,
				created: result.user.created,
				url: result.user.url,
			});

			for (const { repository } of result.user.contribs.commit) {
				repos.set(repository.name, { issues: [], ...repos.get(repository.name), ...repository });
			}
			for (const { repository } of result.user.contribs.issue) {
				issue_repos.add(repository.name);
				repos.set(repository.name, {
					issues: [],
					...repos.get(repository.name),
					...repository,
				});
			}

			created = new Date(result.user.created);
			anchor = new Date(from.getTime() - 1);
		}

		const issue_pool = new Pool(8);
		const fetching: string[] = [];
		for (const name of issue_repos) {
			issue_pool.push(async () => {
				fetching.push(name);
				spinner?.start(`Fetching issues for ${fetching.join(", ")}`);

				const issues: { title: string; created: string; number: number; participants: string[] }[] =
					[];
				let total = 999999;
				let done = false;
				let cursor: string | undefined = undefined;
				while (!done) {
					const { repository } = (await octokit.graphql(query_issues(), {
						owner: name.split("/")[0],
						repo: name.split("/")[1],
						username,
						to: cursor,
					})) as IssuesResult;

					total = repository.issues.total;

					for (const issue of repository.issues.nodes) {
						issues.push({
							title: issue.title,
							created: issue.created,
							number: issue.number,
							participants: issue.participants.nodes.map((user) => user.login),
						});
					}

					if (!repository.issues.page.next) {
						done = true;
					}

					cursor = repository.issues.page.cursor;
					if (spinner) {
						spinner.text = `Fetching issues for ${name} (${issues.length}/${total})`;
					}
				}

				spinner?.succeed(`Fetched issues for ${name} (${issues.length} Issues)`);
				const repo = repos.get(name);
				if (repo) {
					repo.issues = issues;
				}

				fetching.splice(fetching.indexOf(name), 1);
				if (fetching.length > 0) {
					spinner?.start();
				}
			});
		}
		await issue_pool.run();

		spinner?.succeed(
			`Fetched data from GitHub for ${username} (${
				repos.size
			} Repo, ${created.toDateString()} - ${new Date().toDateString()})`,
		);

		fs.writeFileSync(cachefile, JSON.stringify({ user, repos: [...repos.values()] }));
	}

	const sorted_repos = new Map([...repos].sort());
	const sorted_issues = Object.fromEntries(
		[...sorted_repos.entries()].map(([name, { issues }]) => [name, issues]),
	);

	return {
		user,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		repos: [...sorted_repos.values()].map(({ issues, ...repo }) => repo),
		issues: sorted_issues,
	};
}

export function query_meta(): string {
	return `
	query ($username: String!, $from: DateTime!, $to: DateTime!, $max: Int!) {
		user(login: $username) {
			login
			name
			company
			avatar: avatarUrl
			created: createdAt
			url
			contribs: contributionsCollection(from: $from, to: $to) {
				commit: commitContributionsByRepository(maxRepositories: $max) {
					repository {
						name: nameWithOwner
						description
					}
				}
				issue: issueContributionsByRepository(maxRepositories: $max) {
					repository {
						name: nameWithOwner
						description
					}
				}
			}
		}
	}`;
}

export function query_issues(): string {
	return `
	query ($owner: String!, $repo: String!, $to: String, $username: String!) {
		repository(owner: $owner, name: $repo) {
			issues(filterBy: { createdBy: $username }, last: 100, before: $to) {
				total: totalCount
				page: pageInfo {
					next: hasPreviousPage
					cursor: startCursor
				}
				nodes {
					title
					created: createdAt
					number
					participants(first: 10) {
						nodes {
							login
						}
					}
				}
			}
		}
	}`;
}

interface MetaResult {
	user: {
		login: string;
		name: string;
		company: string;
		avatar: string;
		created: string;
		url: string;
		contribs: {
			commit: {
				repository: {
					name: string;
					description: string;
				};
			}[];
			issue: {
				repository: {
					name: string;
					description: string;
				};
			}[];
		};
	};
}

interface IssuesResult {
	repository: {
		issues: {
			total: number;
			page: {
				next: boolean;
				cursor: string;
			};
			nodes: {
				title: string;
				created: string;
				number: number;
				participants: {
					nodes: {
						login: string;
					}[];
				};
			}[];
		};
	};
}
