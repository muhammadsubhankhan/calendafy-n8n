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
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.apiKey}}',
			},
			// body:{
			// 	clientid:"1685917790655x927638688744341500"
			// },
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '=https://crm.calendafy.com/api/1.1/wf/n8n',
			url: '/',
			method: 'POST',
			headers: {
				Authorization: '=Bearer {{$credentials?.apiKey}}',
			},
			body:{
				resource:"credential",
				operation:"check",
				clientid:'{{$credentials?.userid}}'
			}
		},
	};
}
