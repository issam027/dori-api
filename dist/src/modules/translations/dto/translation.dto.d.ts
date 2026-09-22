export declare class CreateTranslationDto {
    translationKey: string;
    category: string;
    locale: string;
    content: string;
    expectedParams?: string[];
}
export declare class UpdateTranslationDto {
    content?: string;
    expectedParams?: string[];
}
