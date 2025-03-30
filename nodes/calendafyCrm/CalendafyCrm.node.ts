import { tz } from 'moment-timezone';
import {
	type IExecuteFunctions,
	type IDataObject,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import {
	accountFields,
	accountOperations,
	appointmentFields,
	appointmentOperations,
	contactFields,
	contactOperations,
	dealFields,
	dealOperations,
	noteFields,
	noteOperations,
	salesActivityFields,
	salesActivityOperations,
	searchFields,
	searchOperations,
	taskFields,
	taskOperations,
} from './descriptions';
import {
	adjustAccounts,
	adjustAttendees,
	calendafyCrmApiRequest,
	getAllItemsViewId,
	handleListing,
	loadResource,
	throwOnEmptyUpdate,
} from './GenericFunctions';
import type { CalendafyConfigResponse, LoadedCurrency, LoadedUser, LoadOption } from './types';

export class CalendafyCrm implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Calendafy CRM',
		name: 'calendafyCrm',
		icon: 'file:calendafy.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume the Calendafy CRM API',
		defaults: {
			name: 'Calendafy CRM',
		},
		usableAsTool: true,
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'calendafyCrmApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Appointment',
						value: 'appointment',
					},
					{
						name: 'Contact',
						value: 'contact',
					},
					{
						name: 'Deal',
						value: 'deal',
					},
					{
						name: 'Note',
						value: 'note',
					},
					{
						name: 'Sales Activity',
						value: 'salesActivity',
					},
					{
						name: 'Search',
						value: 'search',
					},
					{
						name: 'Task',
						value: 'task',
					},
				],
				default: 'account',
			},
			...accountOperations,
			...accountFields,
			...appointmentOperations,
			...appointmentFields,
			...contactOperations,
			...contactFields,
			...dealOperations,
			...dealFields,
			...noteOperations,
			...noteFields,
			...salesActivityOperations,
			...salesActivityFields,
			...searchOperations,
			...searchFields,
			...taskOperations,
			...taskFields,
		],
	};

	methods = {
		loadOptions: {
			async getAccounts(this: ILoadOptionsFunctions) {
				const viewId = await getAllItemsViewId.call(this, { fromLoadOptions: true });
				const responseData = await handleListing.call(
					this,
					'GET',
					`/sales_accounts/view/${viewId}`,
				);

				return responseData.map(({ name, id }) => ({ name, value: id })) as LoadOption[];
			},

			async getAccountViews(this: ILoadOptionsFunctions) {
				const responseData = await handleListing.call(this, 'GET', '/sales_accounts/filters');
				return responseData.map(({ name, id }) => ({ name, value: id })) as LoadOption[];
			},

			async getBusinessTypes(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'business_types');
			},

			async getCampaigns(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'campaigns');
			},

			async getContactStatuses(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'contact_statuses');
			},

			async getContactViews(this: ILoadOptionsFunctions) {
				const responseData = await handleListing.call(this, 'GET', '/contacts/filters');

				return responseData.map(({ name, id }) => ({ name, value: id })) as LoadOption[];
			},

			async getCurrencies(this: ILoadOptionsFunctions) {
				const response = (await calendafyCrmApiRequest.call(
					this,
					'GET',
					'/selector/currencies',
				)) as CalendafyConfigResponse<LoadedCurrency>;

				const key = Object.keys(response)[0];

				return response[key].map(({ currency_code, id }) => ({ name: currency_code, value: id }));
			},

			async getDealPaymentStatuses(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'deal_payment_statuses');
			},

			async getDealPipelines(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'deal_pipelines');
			},

			async getDealProducts(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'deal_products');
			},

			async getDealReasons(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'deal_reasons');
			},

			async getDealStages(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'deal_stages');
			},

			async getDealTypes(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'deal_types');
			},

			async getDealViews(this: ILoadOptionsFunctions) {
				const responseData = await handleListing.call(this, 'GET', '/deals/filters');

				return responseData.map(({ name, id }) => ({ name, value: id })) as LoadOption[];
			},

			async getIndustryTypes(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'industry_types');
			},

			async getLifecycleStages(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'lifecycle_stages');
			},

			async getOutcomes(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'sales_activity_outcomes');
			},

			async getSalesActivityTypes(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'sales_activity_types');
			},

			async getTerritories(this: ILoadOptionsFunctions) {
				return await loadResource.call(this, 'territories');
			},

			async getUsers(this: ILoadOptionsFunctions) {
				// for attendees, owners, and creators
				const response = (await calendafyCrmApiRequest.call(
					this,
					'GET',
					'/selector/owners',
				)) as CalendafyConfigResponse<LoadedUser>;

				const key = Object.keys(response)[0];

				return response[key].map(({ display_name, id }) => ({ name: display_name, value: id }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);
		const defaultTimezone = this.getTimezone();

		let responseData;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'account') {
					// **********************************************************************
					//                                account
					// **********************************************************************

					// https://developers.calendafy.com/crm/api/#accounts

					if (operation === 'create') {
						// ----------------------------------------
						//             account: create
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#create_account

						const body = {
							name: this.getNodeParameter('name', i),
							resource:resource,
							operation:operation

						} as IDataObject;

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, additionalFields);
						}

						responseData = await calendafyCrmApiRequest.call(
							this,
							'POST',
							'/',
							body,
						);
					} else if (operation === 'delete') {
						// ----------------------------------------
						//             account: delete
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#delete_account

						const accountId = this.getNodeParameter('accountId', i);

						const body = {
							resource:resource,
							operation:operation,
							accountId:accountId
						} as IDataObject;

						const endpoint = `/`;
						responseData=await calendafyCrmApiRequest.call(this, 'POST', endpoint,body);
					} else if (operation === 'get') {
						// ----------------------------------------
						//               account: get
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#view_account

						const accountId = this.getNodeParameter('accountId', i);
						const body={
							accountId:accountId,
							resource:resource,
							operation:operation,
						}
						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint,body);
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//             account: getAll
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#list_all_accounts

						const view = this.getNodeParameter('view', i) as string;
						const returnAll = this.getNodeParameter('returnAll', 0);
						const limit = this.getNodeParameter('limit', 0) as number;

						const body={
							resource:resource,
							operation:operation,
							view:view,
							returnAll:returnAll,
							limit:limit
						}

						// responseData = await handleListing.call(this, 'POST', `/`,body);
						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/',body);
					} else if (operation === 'update') {
						// ----------------------------------------
						//             account: update
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#update_a_account

						const accountId = this.getNodeParameter('accountId', i);

						const body = {
							resource:resource,
							operation:operation,
							accountId:accountId

						} as IDataObject;
						const updateFields = this.getNodeParameter('updateFields', i);

						if (Object.keys(updateFields).length) {
							Object.assign(body, updateFields);
						} else {
							throwOnEmptyUpdate.call(this, resource);
						}

						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint, body);
						responseData = responseData;
					}
				} else if (resource === 'appointment') {
					// **********************************************************************
					//                              appointment
					// **********************************************************************

					// https://developers.calendafy.com/crm/api/#appointments

					if (operation === 'create') {
						// ----------------------------------------
						//           appointment: create
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#create_appointment

						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject & {
							time_zone: string;
							is_allday: boolean;
						};

						const startDate = this.getNodeParameter('fromDate', i) as string;
						const endDate = this.getNodeParameter('endDate', i) as string;
						const attendees = this.getNodeParameter('attendees.attendee', i, []) as [
							{ type: string; contactId: string; userId: string },
						];

						const timezone = additionalFields.time_zone ?? defaultTimezone;

						let allDay = false;

						if (additionalFields.is_allday) {
							allDay = additionalFields.is_allday as boolean;
						}

						const start = tz(startDate, timezone);
						const end = tz(endDate, timezone);

						const body = {
							title: this.getNodeParameter('title', i),
							from_date: start.format(),
							end_date: allDay ? start.format() : end.format(),
							resource:resource,
							operation:operation
						} as IDataObject;

						Object.assign(body, additionalFields);

						if (attendees.length) {
							body.appointment_attendees_attributes = adjustAttendees(attendees);
						}
						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/', body);
						responseData = responseData;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//           appointment: delete
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#delete_a_appointment

						const appointmentId = this.getNodeParameter('appointmentId', i);

						const body={
							appointmentId:appointmentId,
							resource:resource,
							operation:operation
						}

						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint,body);
					} else if (operation === 'get') {
						// ----------------------------------------
						//             appointment: get
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#view_a_appointment

						const appointmentId = this.getNodeParameter('appointmentId', i);

						const endpoint = `/`;
						const body={
							appointmentId:appointmentId,
							resource:resource,
							operation:operation
						}
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint,body);
						responseData = responseData;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//           appointment: getAll
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#list_all_appointments

						const { filter, include } = this.getNodeParameter('filters', i) as {
							filter: string;
							include: string[];
						};

						const qs: IDataObject = {};

						if (filter) {
							qs.filter = filter;
						}

						if (include) {
							qs.include = include;
						}
						const body={
							resource:resource,
							operation:operation,
							filter:filter,
							include:include
						}
						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/',body);
						// responseData = await handleListing.call(this, 'GET', '/appointments', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//           appointment: update
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#update_a_appointment

						const updateFields = this.getNodeParameter('updateFields', i) as IDataObject & {
							from_date: string;
							end_date: string;
							time_zone: string;
						};

						const attendees = this.getNodeParameter('updateFields.attendees.attendee', i, []) as [
							{ type: string; contactId: string; userId: string },
						];

						if (!Object.keys(updateFields).length) {
							throwOnEmptyUpdate.call(this, resource);
						}

						const appointmentId = this.getNodeParameter('appointmentId', i);


						const body = {
							resource:resource,
							operation:operation,
							appointmentId:appointmentId
						} as IDataObject;
						const { from_date, end_date, ...rest } = updateFields;

						const timezone = rest.time_zone ?? defaultTimezone;

						if (from_date) {
							body.from_date = tz(from_date, timezone).format();
						}

						if (end_date) {
							body.end_date = tz(end_date, timezone).format();
						}

						Object.assign(body, rest);

						if (attendees.length) {
							body.appointment_attendees_attributes = adjustAttendees(attendees);
							delete body.attendees;
						}

						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'PUT', endpoint, body);
						responseData = responseData.appointment;
					}
				} else if (resource === 'contact') {
					// **********************************************************************
					//                                contact
					// **********************************************************************

					// https://developers.calendafy.com/crm/api/#contacts

					if (operation === 'create') {
						// ----------------------------------------
						//             contact: create
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#create_contact

						const body = {
							first_name: this.getNodeParameter('firstName', i),
							last_name: this.getNodeParameter('lastName', i),
							emails: this.getNodeParameter('emails', i),
							resource:resource,
							operation:operation
						} as IDataObject;

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustAccounts(additionalFields));
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/', body);
						responseData = responseData;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//             contact: delete
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#delete_a_contact

						const contactId = this.getNodeParameter('contactId', i);
						const body={
							resource:resource,
							operation:operation,
							contactId:contactId
						}
						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint,body);
						
					} else if (operation === 'get') {
						// ----------------------------------------
						//               contact: get
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#view_a_contact

						const contactId = this.getNodeParameter('contactId', i);
						const body={
							resource:resource,
							operation:operation,
							contactId:contactId
						}
						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint,body);
						responseData = responseData;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//             contact: getAll
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#list_all_contacts

						const view = this.getNodeParameter('view', i) as string;
						const body={
							resource:resource,
							operation:operation,
							view:view
						}
						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/',body);
						// responseData = await handleListing.call(this, 'GET', `/contacts/view/${view}`);
					} else if (operation === 'update') {
						// ----------------------------------------
						//             contact: update
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#update_a_contact

						const contactId = this.getNodeParameter('contactId', i);

						const body = {
							resource:resource,
							operation:operation,
							contactId:contactId
						} as IDataObject;
						const updateFields = this.getNodeParameter('updateFields', i);

						if (Object.keys(updateFields).length) {
							Object.assign(body, adjustAccounts(updateFields));
						} else {
							throwOnEmptyUpdate.call(this, resource);
						}


						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint, body);
						responseData = responseData;
					}
				} else if (resource === 'deal') {
					// **********************************************************************
					//                                  deal
					// **********************************************************************

					// https://developers.calendafy.com/crm/api/#deals

					if (operation === 'create') {
						// ----------------------------------------
						//               deal: create
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#create_deal

						const body = {
							name: this.getNodeParameter('name', i),
							amount: this.getNodeParameter('amount', i),
							resource:resource,
							operation:operation
						} as IDataObject;

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustAccounts(additionalFields));
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/', body);
						responseData = responseData;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//               deal: delete
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#delete_a_deal

						const dealId = this.getNodeParameter('dealId', i);
						const body={
							resource:resource,
							operation:operation,
							dealId:dealId
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', `/`,body);
						
					} else if (operation === 'get') {
						// ----------------------------------------
						//                deal: get
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#view_a_deal

						const dealId = this.getNodeParameter('dealId', i);
						const body={
							resource:resource,
							operation:operation,
							dealId:dealId
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', `/`,body);
						responseData = responseData.deal;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//               deal: getAll
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#list_all_deals

						const view = this.getNodeParameter('view', i) as string;

						const body={
							resource:resource,
							operation:operation,
							view:view
						}
						responseData = await calendafyCrmApiRequest.call(this, 'POST', `/`,body);

					} else if (operation === 'update') {
						// ----------------------------------------
						//               deal: update
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#update_a_deal
						const dealId = this.getNodeParameter('dealId', i);

						const body = {
							resource:resource,
							operation:operation,
							dealId:dealId
						} as IDataObject;
						const updateFields = this.getNodeParameter('updateFields', i);

						if (Object.keys(updateFields).length) {
							Object.assign(body, adjustAccounts(updateFields));
						} else {
							throwOnEmptyUpdate.call(this, resource);
						}


						responseData = await calendafyCrmApiRequest.call(
							this,
							'POST',
							`/`,
							body,
						);
						responseData = responseData.deal;
					}
				} else if (resource === 'note') {
					// **********************************************************************
					//                                  note
					// **********************************************************************

					// https://developers.calendafy.com/crm/api/#notes

					if (operation === 'create') {
						// ----------------------------------------
						//               note: create
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#create_note

						const body = {
							description: this.getNodeParameter('description', i),
							targetable_id: this.getNodeParameter('targetable_id', i),
							targetable_type: this.getNodeParameter('targetableType', i),
							resource:resource,
							operation:operation
						} as IDataObject;

						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/', body);
						responseData = responseData;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//               note: delete
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#delete_a_note

						const noteId = this.getNodeParameter('noteId', i);
						const body={
							resource:resource,
							operation:operation,
							noteId:noteId
						}

						responseData=await calendafyCrmApiRequest.call(this, 'POST', `/`,body);
						
					} else if (operation === 'update') {
						// ----------------------------------------
						//               note: update
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#update_a_note

						
						const noteId = this.getNodeParameter('noteId', i);

						const body = {
							resource:resource,
							operation:operation,
							noteId:noteId
						} as IDataObject;
						const updateFields = this.getNodeParameter('updateFields', i);

						if (Object.keys(updateFields).length) {
							Object.assign(body, updateFields);
						} else {
							throwOnEmptyUpdate.call(this, resource);
						}

						responseData = await calendafyCrmApiRequest.call(
							this,
							'POST',
							`/`,
							body,
						);
						responseData = responseData;
					}
				} else if (resource === 'salesActivity') {
					// **********************************************************************
					//                             salesActivity
					// **********************************************************************

					// https://developers.calendafy.com/crm/api/#sales-activities

					if (operation === 'create') {
						// ----------------------------------------
						//          salesActivity: create
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#create_sales_activity

						const startDate = this.getNodeParameter('from_date', i) as string;
						const endDate = this.getNodeParameter('end_date', i) as string;

						const body = {
							sales_activity_type_id: this.getNodeParameter('sales_activity_type_id', i),
							title: this.getNodeParameter('title', i),
							owner_id: this.getNodeParameter('ownerId', i),
							start_date: tz(startDate, defaultTimezone).format(),
							end_date: tz(endDate, defaultTimezone).format(),
							targetable_type: this.getNodeParameter('targetableType', i),
							targetable_id: this.getNodeParameter('targetable_id', i),
							resource:resource,
							operation:operation
						} as IDataObject;

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, additionalFields);
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/', body);
						responseData = responseData;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//          salesActivity: delete
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#delete_a_sales_activity

						const salesActivityId = this.getNodeParameter('salesActivityId', i);
						const body={
							resource:resource,
							operation:operation,
							salesActivityId:salesActivityId
						}
						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint,body);
						
					} else if (operation === 'get') {
						// ----------------------------------------
						//            salesActivity: get
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#view_a_sales_activity

						const salesActivityId = this.getNodeParameter('salesActivityId', i);
						const body={
							salesActivityId:salesActivityId,
							resource:resource,
							operation:operation
						}
						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint,body);
						responseData = responseData;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//          salesActivity: getAll
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#list_all_sales_activities
						const body={
							resource:resource,
							operation:operation
						}
						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/',body);

						// responseData = await handleListing.call(this, 'GET', '/sales_activities');
					} else if (operation === 'update') {
						// ----------------------------------------
						//          salesActivity: update
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#update_a_sales_activity

						const updateFields = this.getNodeParameter('updateFields', i) as IDataObject & {
							from_date: string;
							end_date: string;
							time_zone: string;
						};

						if (!Object.keys(updateFields).length) {
							throwOnEmptyUpdate.call(this, resource);
						}

						const salesActivityId = this.getNodeParameter('salesActivityId', i);

						const body = {
							resource:resource,
							operation:operation,
							salesActivityId:salesActivityId
						} as IDataObject;
						const { from_date, end_date, ...rest } = updateFields;

						if (from_date) {
							body.from_date = tz(from_date, defaultTimezone).format();
						}

						if (end_date) {
							body.end_date = tz(end_date, defaultTimezone).format();
						}

						if (Object.keys(rest).length) {
							Object.assign(body, rest);
						}


						const endpoint = `/`;
						responseData = await calendafyCrmApiRequest.call(this, 'POST', endpoint, body);
						responseData = responseData;
					}
				} else if (resource === 'search') {
					// **********************************************************************
					//                             search
					// **********************************************************************

					if (operation === 'query') {
						// https://developers.calendafy.com/crm/api/#search
						const query = this.getNodeParameter('query', i) as string;
						let entities = this.getNodeParameter('entities', i);
						// const returnAll = this.getNodeParameter('returnAll', 0, false);

						if (Array.isArray(entities)) {
							entities = entities.join(',');
						}

						const body={
							q: query,
							include: entities,
							per_page: 100,
							resource:resource,
							operation:operation
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/', body);

						// if (!returnAll) {
						// 	const limit = this.getNodeParameter('limit', 0);
						// 	responseData = responseData.slice(0, limit);
						// }
					}

					if (operation === 'lookup') {
						// https://developers.calendafy.com/crm/api/#lookup_search
						let searchField = this.getNodeParameter('searchField', i) as string;
						let fieldValue = this.getNodeParameter('fieldValue', i, '') as string;
						let entities = this.getNodeParameter('options.entities', i) as string;
						if (Array.isArray(entities)) {
							entities = entities.join(',');
						}

						if (searchField === 'customField') {
							searchField = this.getNodeParameter('customFieldName', i) as string;
							fieldValue = this.getNodeParameter('customFieldValue', i) as string;
						}

						const body={
							q: fieldValue,
							f: searchField,
							entities,
							resource:resource,
							operation:operation
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/lookup', body);
					}
				} else if (resource === 'task') {
					// **********************************************************************
					//                                  task
					// **********************************************************************

					// https://developers.calendafy.com/crm/api/#tasks

					if (operation === 'create') {
						// ----------------------------------------
						//               task: create
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#create_task

						const dueDate = this.getNodeParameter('dueDate', i);

						const body = {
							title: this.getNodeParameter('title', i),
							owner_id: this.getNodeParameter('ownerId', i),
							due_date: tz(dueDate, defaultTimezone).format(),
							targetable_type: this.getNodeParameter('targetableType', i),
							targetable_id: this.getNodeParameter('targetable_id', i),
							resource:resource,
							operation:operation
						} as IDataObject;

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, additionalFields);
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', '/', body);
						responseData = responseData;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//               task: delete
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#delete_a_task

						const taskId = this.getNodeParameter('taskId', i);
						const body={
							resource:resource,
							operation:operation,
							taskId:taskId
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', `/`,body);
						
					} else if (operation === 'get') {
						// ----------------------------------------
						//                task: get
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#view_a_task

						const taskId = this.getNodeParameter('taskId', i);

						const body={
							resource:resource,
							operation:operation,
							taskId:taskId
						}

						responseData = await calendafyCrmApiRequest.call(this, 'POST', `/`,body);
						responseData = responseData;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//               task: getAll
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#list_all_tasks

						const { filter, include } = this.getNodeParameter('filters', i) as {
							filter: string;
							include: string;
						};

						const body={
							filter: 'open',
							resource:resource,
							operation:operation,
							include:""
						}
						if (filter) {
							body.filter = filter;
						}

						if (include) {
							body.include = include;
						}

						responseData = await handleListing.call(this, 'POST', '/', body);
					} else if (operation === 'update') {
						// ----------------------------------------
						//               task: update
						// ----------------------------------------

						// https://developers.calendafy.com/crm/api/#update_a_task

						const taskId = this.getNodeParameter('taskId', i);

						const body = {
							resource:resource,
							operation:operation,
							taskId:taskId
						} as IDataObject;
						const updateFields = this.getNodeParameter('updateFields', i);

						if (!Object.keys(updateFields).length) {
							throwOnEmptyUpdate.call(this, resource);
						}

						const { dueDate, ...rest } = updateFields;

						if (dueDate) {
							body.due_date = tz(dueDate, defaultTimezone).format();
						}

						if (Object.keys(rest).length) {
							Object.assign(body, rest);
						}


						responseData = await calendafyCrmApiRequest.call(
							this,
							'POST',
							`/`,
							body,
						);
						responseData = responseData.task;
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const executionErrorData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: error.message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionErrorData);
					continue;
				}
				throw error;
			}

			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray(responseData as IDataObject),
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		}

		return [returnData];
	}
}
