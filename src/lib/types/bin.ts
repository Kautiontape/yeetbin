export interface BinData {
	id: string;
	content: string;
	type: string;
	language: string | null;
	mode: 'read-only' | 'editable' | 'forkable';
	encrypted: boolean;
	forked_from: string | null;
	expires_at: string | null;
	burn: boolean;
	created_at: string;
	updated_at: string;
	has_password: boolean;
}

export interface CreateBinRequest {
	content: string;
	type?: string;
	language?: string;
	mode?: 'read-only' | 'editable' | 'forkable';
	password?: string;
	encrypted?: boolean;
	expires_at?: string;
	burn?: boolean;
}
