import SqlString from 'sqlstring';
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

	const mysql = await getConnection();

	const escape = SqlString.escape;

	const userIds = await getAllUserIds(input.userId, input.userName, mysql);

	if (!userIds?.length) {
		return {
			statusCode: 200,
			isBase64Encoded: false,
			body: JSON.stringify({ results: [] }),
		};
	}

	// First-time user, no mapping registered yet
	if (!userIds?.length) {
		return {
			statusCode: 200,
			body: null,
		};
	}

	const existingQuery = `
		SELECT * 
		FROM arena_rewards
		WHERE userId IN (${escape(userIds)})
	`;
	const results: readonly ArenaRewardInfo[] = await mysql.query(existingQuery);
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

const getAllUserIds = async (userId: string, userName: string, mysql): Promise<readonly string[]> => {
	const escape = SqlString.escape;
	const userSelectQuery = `
			SELECT DISTINCT userId FROM user_mapping
			INNER JOIN (
				SELECT DISTINCT username FROM user_mapping
				WHERE 
					(username = ${escape(userName)} OR username = ${escape(userId)} OR userId = ${escape(userId)})
					AND username IS NOT NULL
					AND username != ''
					AND username != 'null'
					AND userId != ''
					AND userId IS NOT NULL
					AND userId != 'null'
			) AS x ON x.username = user_mapping.username
			UNION ALL SELECT ${escape(userId)}
		`;
	console.log('running query', userSelectQuery);
	const userIds: any[] = await mysql.query(userSelectQuery);
	console.log('query over', userIds);
	return userIds.map((result) => result.userId);
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
