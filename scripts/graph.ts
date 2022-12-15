import { config } from "dotenv";
import { Octokit } from "octokit";
import type { Ora } from "ora";

config();

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

	spinner?.start("Fetching data from GitHub");

	while (anchor > created) {
		const to = new Date(anchor);
		const from = new Date(anchor.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
		if (spinner) {
			spinner.text = `Fetching data from ${from.toDateString()} to ${to.toDateString()}`;
		}

		const result = (await octokit.graphql(ql(), { username, from, to, max })) as Result;

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
			repos.set(repository.name, {
				...repos.get(repository.name),
				...repository,
				issues: repository.issues.nodes.map((issue) => ({
					...issue,
					participants: issue.participants.nodes.map((participant) => participant.login),
				})),
			});
		}

		created = new Date(result.user.created);
		anchor = new Date(from.getTime() - 1);
	}

	spinner?.succeed(
		`Fetched data from GitHub for ${username} (${
			repos.size
		} Repo, ${created.toDateString()} - ${new Date().toDateString()})`,
	);

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

export function ql(): string {
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
						issues(filterBy: { createdBy: $username }, last: 100) {
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
				}
			}
		}
	}`;
}

interface Result {
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
					issues: {
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
			}[];
		};
	};
}
