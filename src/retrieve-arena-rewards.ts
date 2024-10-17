/* eslint-disable no-extra-boolean-cast */
import { getConnectionProxy } from '@firestone-hs/aws-lambda-utils';
import { gzipSync } from 'zlib';
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
	// console.debug('handling event', input);

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
	// console.debug('getting connection 2');
	const mysql = await getConnectionProxy();
	// console.debug('got connection');
	const results: readonly ArenaRewardInfo[] = await mysql.query(query, [input.userName || input.userId]);
	await mysql.end();

	// console.debug('will stringify results');
	const stringResults = JSON.stringify(results);
	// console.debug('stringified results');
	const gzippedResults = stringResults ? gzipSync(stringResults).toString('base64') : null;
	// console.debug('gzipped results');
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
