import {
	OptionsWithUri,
} from 'request';

import {
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
} from 'n8n-core';

import {
	IDataObject,
} from 'n8n-workflow';

import * as jwt from 'jsonwebtoken';

export async function ghostApiRequest(this: IHookFunctions | IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions, method: string, endpoint: string, body: any = {}, query: IDataObject = {}, uri?: string): Promise<any> { // tslint:disable-line:no-any

	const source = this.getNodeParameter('source', 0) as string;

	let credentials;
	let version;
	let token;

	if (source === 'contentApi') {
		//https://ghost.org/faq/api-versioning/
		version = 'v3';
		credentials = this.getCredentials('ghostContentApi') as IDataObject;
		query.key = credentials.apiKey as string;
	} else {
		version = 'v2';
		credentials = this.getCredentials('ghostAdminApi') as IDataObject;
		// Create the token (including decoding secret)
		const [id, secret] = (credentials.apiKey as string).split(':');

		token = jwt.sign({}, Buffer.from(secret, 'hex'), {
			keyid: id,
			algorithm: 'HS256',
			expiresIn: '5m',
			audience: `/${version}/admin/`,
		});
	}

	const options: OptionsWithUri = {
		method,
		qs: query,
		uri: uri || `${credentials.url}/ghost/api/${version}${endpoint}`,
		body,
		json: true,
	};

	if (token) {
		options.headers = {
			Authorization: `Ghost ${token}`,
		};
	}

	try {
		return await this.helpers.request!(options);

	} catch (error) {
		let errorMessages;

		if (error.response && error.response.body && error.response.body.errors) {

			if (Array.isArray(error.response.body.errors)) {

				const errors = error.response.body.errors;

				errorMessages = errors.map((e: IDataObject) => e.message);
			}

			throw new Error(`Ghost error response [${error.statusCode}]: ${errorMessages?.join('|')}`);
		}

		throw error;
	}
}

export async function ghostApiRequestAllItems(this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions, propertyName: string, method: string, endpoint: string, body: any = {}, query: IDataObject = {}): Promise<any> { // tslint:disable-line:no-any

	const returnData: IDataObject[] = [];

	let responseData;

	query.limit = 20;

	let uri: string | undefined;

	do {
		responseData = await ghostApiRequest.call(this, method, endpoint, body, query, uri);
		uri = responseData.meta.pagination.next;
		returnData.push.apply(returnData, responseData[propertyName]);
	} while (
		responseData.meta.pagination.next !== null
	);
	return returnData;
}

export function validateJSON(json: string | undefined): any { // tslint:disable-line:no-any
	let result;
	try {
		result = JSON.parse(json!);
	} catch (exception) {
		result = undefined;
	}
	return result;
}
