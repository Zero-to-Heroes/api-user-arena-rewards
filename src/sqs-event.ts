export interface Input {
	readonly userId: string;
	readonly userName: string;
	readonly type: 'arena';
	readonly reviewId: string;
	readonly runId: string;
	readonly rewards: readonly Reward[];
	readonly currentWins: number;
	readonly currentLosses: number;
	readonly appVersion: string;
}

export interface Reward {
	readonly Type: number;
	readonly Amount: number;
	readonly BoosterId: number;
}
