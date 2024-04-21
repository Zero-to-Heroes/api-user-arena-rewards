/* eslint-disable @typescript-eslint/no-use-before-define */
import { ServerlessMysql } from 'serverless-mysql';
import SqlString from 'sqlstring';
import { getConnection } from './db/rds';
import { Input } from './sqs-event';

export default async (event, context): Promise<any> => {
	const events: readonly Input[] = (event.Records as any[])
		.map(event => JSON.parse(event.body))
		.reduce((a, b) => a.concat(b), [])
		.filter(event => event);
	// TODO: do some filtering to keep only the latest for a given userId or userName
	const mysql = await getConnection();
	for (const ev of events) {
		await processEvent(ev, mysql);
	}
	const response = {
		statusCode: 200,
		isBase64Encoded: false,
		body: null,
	};
	await mysql.end();
	return response;
};

const processEvent = async (input: Input, mysql: ServerlessMysql) => {
	const escape = SqlString.escape;
	console.debug('handling event', input);

	if (!input.rewards?.length) {
		console.error('empty rewards', input);
		return;
	}

	if (!input.runId) {
		console.log('no run id', input);
		return;
	}

	const selectQuery = `
		SELECT * FROM arena_rewards
		WHERE runId = ?
		AND creationDate > DATE_SUB(NOW(), INTERVAL 2 HOUR)
		LIMIT 1;
	`;
	console.debug('running query', selectQuery);
	const selectResult: any[] = await mysql.query(selectQuery, [input.runId]);
	console.debug('select result', selectResult);
	if (selectResult && !!selectResult.length) {
		console.log('already registered rewards for run', input.runId);
		return;
	}

	for (const reward of input.rewards) {
		const insertQuery = `
			INSERT IGNORE INTO arena_rewards
			(
				creationDate,
				userId, 
				userName, 
				reviewId,
				runId,
				rewardType,
				rewardAmount,
				rewardBoosterId,
				wins,
				losses
			)
			VALUES (
				${escape(new Date())},
				${escape(input.userId)},
				${escape(input.userName)},
				${escape(input.reviewId)},
				${escape(input.runId)},
				${escape(reward.Type)},
				${escape(reward.Amount)},
				${escape(reward.BoosterId)},
				${escape(input.currentWins)},
				${escape(input.currentLosses)}
			);
		`;
		console.log('running query', insertQuery);
		const insertResults: readonly any[] = await mysql.query(insertQuery);
		console.log(
			'executed query',
			insertResults && insertResults.length,
			insertResults && insertResults.length > 0 && insertResults[0],
		);
	}
};
