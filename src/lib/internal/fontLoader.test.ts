import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { preloadFonts, __setFontLoader, __clearFontCache, __resetFontLoader } from './fontLoader';
import type { FontConfig } from '../types';

class MockLoader {
	public loads: string[] = [];
	public shouldFail = false;

	load(
		url: string,
		onLoad: () => void,
		_onProgress?: (progress: unknown) => void,
		onError?: (error: Error) => void
	) {
		if (this.shouldFail) {
			onError?.(new Error('mock failure'));
			return;
		}
		this.loads.push(url);
		onLoad();
	}
}

describe('preloadFonts', () => {
	beforeEach(() => {
		__clearFontCache();
	});

	afterEach(() => {
		__resetFontLoader();
	});

	it('deduplicates font URLs before loading', async () => {
		const loader = new MockLoader();
		__setFontLoader(loader);

		const fonts: FontConfig[] = [
			{ url: '/fonts/a.otf' },
			{ url: '/fonts/a.otf' },
			{ url: '/fonts/b.otf' }
		];

		await preloadFonts(fonts);

		expect(loader.loads).toEqual(['/fonts/a.otf', '/fonts/b.otf']);
	});

	it('rejects when a font fails to load', async () => {
		const loader = new MockLoader();
		loader.shouldFail = true;
		__setFontLoader(loader);

		await expect(preloadFonts([{ url: '/fonts/c.otf' }])).rejects.toThrow('mock failure');
	});
});
