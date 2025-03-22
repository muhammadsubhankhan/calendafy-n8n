import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';


type Icon = any;

export class CalendafyCrmApi implements ICredentialType {
	name = 'calendafyCrmApi';

	displayName = 'Calendafy CRM API';
	icon = 'file:calendafy.png' as Icon;
	documentationUrl = '';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'BDsTn15vHezBlt_XGp3Tig',
		},
		{
			displayName: 'User Id',
			name: 'userid',
			type: 'string',
			default: '',
			placeholder: '',
		},
		{
			displayName: 'Domain',
			name: 'domain',
			type: 'string',
			default: '',
			placeholder: 'n8n-org',
			description:
				'Domain in the calendafy CRM org URL. For example, in <code>https://n8n-org.mycalendafy.com</code>, the domain is <code>n8n-org</code>.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Token token={{$credentials?.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '=https://{{$credentials?.domain}}.myfreshworks.com/crm/sales/api',
			url: '/tasks',
			method: 'GET',
		},
	};
}
