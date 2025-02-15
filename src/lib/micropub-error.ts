class MicropubError extends Error {
	status: number | null;
	error: unknown;

	constructor(message: string, status = 0, error: unknown = null) {
		super(message);
		this.name = "MicropubError";

		if (error instanceof MicropubError) {
			this.message = error.message;
			this.status = error.status;
			this.error = error.error;
		} else {
			this.status = status === 0 ? null : status;
			this.error = error;
		}
	}
}

export { MicropubError };
