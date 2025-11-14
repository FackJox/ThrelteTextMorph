import { preloadFont } from 'troika-three-text';
import type { FontConfig } from '../types';

type Loader = {
	load: (
		url: string,
		onLoad: () => void,
		onProgress?: (progress: unknown) => void,
		onError?: (error: Error) => void
	) => void;
};

const defaultLoader: Loader = {
	load(url, onLoad, _onProgress, onError) {
		try {
			preloadFont({ font: url }, () => {
				onLoad();
			});
		} catch (error) {
			onError?.(error instanceof Error ? error : new Error(String(error)));
		}
	}
};

let fontLoader: Loader = defaultLoader;

const fontPromises = new Map<string, Promise<void>>();

async function loadFontUrl(url: string): Promise<void> {
	if (!url) {
		throw new Error('Font URL is required.');
	}

	if (fontPromises.has(url)) {
		return fontPromises.get(url)!;
	}

	const promise = new Promise<void>((resolve, reject) => {
		fontLoader.load(
			url,
			() => resolve(),
			undefined,
			(err) => {
				reject(err ?? new Error(`Failed to load font: ${url}`));
			}
		);
	});

	fontPromises.set(url, promise);
	return promise;
}

export function preloadFonts(fonts: FontConfig[]): Promise<void> {
	const loaders = fonts
		.map((font) => font.url)
		.filter((url, index, arr) => typeof url === 'string' && arr.indexOf(url) === index)
		.map((url) => loadFontUrl(url));

	return Promise.all(loaders).then(() => undefined);
}

export function getFontPromise(url: string): Promise<void> | undefined {
	return fontPromises.get(url);
}

export function __setFontLoader(loader: Loader) {
	fontLoader = loader;
}

export function __clearFontCache() {
	fontPromises.clear();
}

export function __resetFontLoader() {
	fontLoader = defaultLoader;
	__clearFontCache();
}

export function areFontsReady(fonts: FontConfig[]): boolean {
	return Array.isArray(fonts) && fonts.some((font) => typeof font?.url === 'string' && font.url.length > 0);
}
