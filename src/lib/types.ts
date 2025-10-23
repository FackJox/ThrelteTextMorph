export type MorphMode = 'font' | 'text' | 'combined';

export type SequenceMode = 'forwards' | 'backwards' | 'random';

export type EasingPreset =
	| 'linear'
	| 'easeIn'
	| 'easeOut'
	| 'easeInOut'
	| 'easeInBack'
	| 'easeOutBack'
	| 'easeInOutBack'
	| 'anticipate'
	| 'easeInOutQuad'
	| 'easeInOutCubic'
	| 'easeInOutSine'
	| 'easeInCirc'
	| 'easeOutCirc'
	| 'easeInOutCirc'
	| 'easeInExpo'
	| 'easeOutExpo'
	| 'easeInOutExpo';

export interface FontConfig {
	url: string;
	sizeOffset?: number;
	letterSpacing?: number;
	baselineShift?: number;
	weight?: number;
}

export interface MorphEventPayload {
	elapsedTime: number;
	fontIndex: number;
	textIndex: number;
	fontUrl: string | null;
	text: string;
}
