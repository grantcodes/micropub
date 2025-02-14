interface MicropubSyndicationTargetService {
	name: string;
	url?: string;
	photo?: string;
}

interface MicropubSyndicationTargetUser {
	name: string;
	url?: string;
	photo?: string;
}

export interface MicropubSyndicationTarget {
	uid: string;
	name: string;
	service?: MicropubSyndicationTargetService;
	user?: MicropubSyndicationTargetUser;
}

export interface MicropubConfigQueryResponse {
	"media-endpoint"?: string;
	"syndicate-to"?: MicropubSyndicationTarget[];
	[key: string]: any;
}

export interface MicropubError {
	error: string;
	error_description?: string;
}

export interface MicropubActionRequestRoot {
	action: "delete" | "undelete" | "update";
	url: string;
}

export interface MicropubDeleteActionRequest extends MicropubActionRequest {
	action: "delete";
}

export interface MicropubUndeleteActionRequest extends MicropubActionRequest {
	action: "undelete";
}

export interface MicropubUpdateActionRequest extends MicropubActionRequest {
	action: "update";
	replace?: Record<string, any>;
	add?: Record<string, any>;
	delete?: Record<string, any>;
}

export type MicropubActionRequest =
	| MicropubDeleteActionRequest
	| MicropubUndeleteActionRequest
	| MicropubUpdateActionRequest;
