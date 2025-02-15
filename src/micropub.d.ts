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
	// biome-ignore lint/suspicious/noExplicitAny: Could be anything returned from the config query
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
	// biome-ignore lint/suspicious/noExplicitAny: Could be anything inside an update request
	replace?: Record<string, any>;
	// biome-ignore lint/suspicious/noExplicitAny: Could be anything inside an update request
	add?: Record<string, any>;
	// biome-ignore lint/suspicious/noExplicitAny: Could be anything inside an update request
	delete?: Record<string, any>;
}

export type MicropubActionRequest =
	| MicropubDeleteActionRequest
	| MicropubUndeleteActionRequest
	| MicropubUpdateActionRequest;
