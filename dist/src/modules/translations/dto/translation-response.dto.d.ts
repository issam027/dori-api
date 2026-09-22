export declare class TranslationBundleResponseDto {
    locale: string;
    category: string;
    version: number;
    entries: Record<string, string>;
}
export declare class TranslationResponseDto {
    translationId: number;
    translationKey: string;
    locale: string;
    content: string;
    expectedParams?: string[] | null;
    category: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
