export interface Catalogue { version: string; major: number; worlds: number; classes: number; badges: number; slots: number }
export function readCatalogue(): Promise<Catalogue>;
export function description(studio: Catalogue): string;
