export interface SSEEvent {
	type: string;
	data: unknown;
}

export interface SSEDeltaResult<TState> {
	events: SSEEvent[];
	state: TState;
}
