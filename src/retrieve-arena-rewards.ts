/* eslint-disable no-extra-boolean-cast */
import { gzipSync } from 'zlib';
import { getConnection } from './db/rds';
import { Input } from './sqs-event';

export default async (event): Promise<any> => {
	if (!event?.body?.length) {
		return {
			statusCode: 400,
			isBase64Encoded: false,
			body: null,
		};
	}

	const input: Input = JSON.parse(event.body);
	console.debug('handling event', input);

	let query = `
		SELECT * 
		FROM arena_rewards_2
		WHERE creationDate >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
		AND userName = ?
	`;
	if (!input?.userName) {
		query = `
			SELECT *
			FROM arena_rewards_2
			WHERE creationDate >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
			AND userId = ?
		`;
	}
	const mysql = await getConnection();
	const results: readonly ArenaRewardInfo[] = await mysql.query(query, [input.userName || input.userId]);
	await mysql.end();

	const stringResults = JSON.stringify(results);
	const gzippedResults = stringResults ? gzipSync(stringResults).toString('base64') : null;
	const response = {
		statusCode: 200,
		isBase64Encoded: true,
		body: gzippedResults,
		headers: {
			'Content-Type': 'text/html',
			'Content-Encoding': 'gzip',
		},
	};

	return response;
};

export interface ArenaRewardInfo {
	readonly creationDate: string;
	readonly userId: string;
	readonly userName: string;
	readonly reviewId: string;
	readonly runId: string;
	readonly rewardType: number;
	readonly rewardAmount: number;
	readonly rewardBoosterId: number;
	readonly wins: number;
	readonly losses: number;
}
