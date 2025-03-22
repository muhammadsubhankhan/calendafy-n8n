import type {
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

export class CalendafyCrmTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Calendafy CRM Trigger',
		name: 'calendafyCrmTrigger',
		icon: 'file:calendafy.png',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when Calendafy events occur',
		defaults: {
			name: 'Calendafy Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'calendafyCrmApi',
				required: false,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
			{
				name: 'setup',
				httpMethod: 'GET',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'Contact Created',
						value: 'contact.creation',
						description: "To get notified if any contact is created in a customer's account",
					},
					{
						name: 'Deal Created',
						value: 'deal.creation',
						description: "To get notified if any deal is created in a customer's account",
					},
				],
				default: 'contact.creation',
				required: true,
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Max Concurrent Requests',
						name: 'maxConcurrentRequests',
						type: 'number',
						typeOptions: {
							minValue: 5,
						},
						default: 5,
					},
				],
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		// const credentials = await this.getCredentials('calendafyCrmApi');

		// if (credentials === undefined) {
		// 	throw new NodeOperationError(this.getNode(), 'No credentials found!');
		// }

		const req = this.getRequestObject();

		// ✅ Ensure bodyData is an array or default to an empty array
		let bodyData = req.body;

	// Ensure bodyData is an array
	if (!Array.isArray(bodyData)) {
		bodyData = [bodyData];
	}

		// ✅ Loop through the body data to extract needed info
		for (let i = 0; i < bodyData.length; i++) {
			const subscriptionType = bodyData[i]?.subscriptionType as string;

			if (subscriptionType?.includes('contact.creation')) {
				bodyData[i].contactId = bodyData[i].objectId;
			}
			if (subscriptionType?.includes('deal.creation')) {
				bodyData[i].dealId = bodyData[i].objectId;
			}

			// ✅ Remove objectId after processing
			delete bodyData[i].objectId;
		}

		// ✅ Return processed data to the workflow
		return {
			workflowData: [this.helpers.returnJsonArray(bodyData as IDataObject[])],
		};
	}
}
