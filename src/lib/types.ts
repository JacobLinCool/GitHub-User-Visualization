export type RepoName = `${string}/${string}` | string;

export interface Commit {
	sha: string;
	date: Date;
	message: string;
	files: string[];
}

export type Commits = Record<RepoName, Commit[]>;

export interface Issue {
	title: string;
	created: Date;
	number: number;
	participants: string[];
}

export type Issues = Record<RepoName, Issue[]>;

export interface Repo {
	name: RepoName;
	description: string;
}

export type Repos = Repo[];

export interface User {
	name: string;
	company: string;
	avatar: string;
	created: Date;
	url: string;
}
