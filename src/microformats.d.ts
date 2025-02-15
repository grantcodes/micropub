export interface MicroformatRoot {
	id?: string;
	lang?: string;
	type?: string[];
	properties: MicroformatProperties;
	children?: MicroformatRoot[];
	value?: MicroformatProperty;
}

export interface Image {
	alt: string;
	value?: string;
}

export interface Html {
	html: string;
	value: string;
	lang?: string;
}

export type MicroformatProperty = MicroformatRoot | Image | Html | string;
export type MicroformatProperties = Record<string, MicroformatProperty[]>;

export interface MicroformatFormEncoded {
	h: string;
	[key: string]: string | string[];
}
