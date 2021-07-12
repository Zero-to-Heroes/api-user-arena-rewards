import SqlString from 'sqlstring';
import { gzipSync } from 'zlib';
import { getConnection } from './db/rds';
import { Input } from './sqs-event';

export default async (event): Promise<any> => {
	const input: Input = JSON.parse(event.body);
	console.debug('handling event', input);

	const mysql = await getConnection();

	const escape = SqlString.escape;
	const userQuery = `
		SELECT DISTINCT userId, userName
		FROM user_mapping
		WHERE userId = ${escape(input.userId)} OR userName = ${input.userName ? escape(input.userName) : escape('__invalid__')}
	`;
	const userMappingDbResults: readonly any[] = await mysql.query(userQuery);
	console.log(
		'executed query',
		userMappingDbResults && userMappingDbResults.length,
		userMappingDbResults && userMappingDbResults.length > 0 && userMappingDbResults[0],
	);

	const userIds = [...new Set(userMappingDbResults.map(result => result.userId).filter(userId => userId?.length))];
	// First-time user, no mapping registered yet
	if (!userIds?.length) {
		return {
			statusCode: 200,
			body: null,
		};
	}

	const userNames = [...new Set(userMappingDbResults.map(result => result.userName))]
		.filter(userName => userName != '__invalid')
		.filter(userName => userName?.length && userName.length > 0);
	const userIdCriteria = `userId IN (${userIds.map(userId => escape(userId)).join(',')})`;
	const linkWord = userIds.length > 0 && userNames.length > 0 ? 'OR ' : '';

	const userNameCriteria =
		userNames.length > 0 ? `userName IN (${userNames.map(result => escape(result)).join(',')})` : '';
	const existingQuery = `
		SELECT * 
		FROM arena_rewards
		WHERE ${userIdCriteria} ${linkWord} ${userNameCriteria}
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
