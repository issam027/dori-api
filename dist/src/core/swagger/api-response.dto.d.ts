export declare class StandardResponseDto<T> {
    code: string;
    translationKey: string | null;
    translationParams: Record<string, any>;
    data: T;
}
export declare class PaginatedResultDto<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}
export declare class StandardErrorResponseDto {
    code: string;
    translationKey: string;
    translationParams: Record<string, any>;
    data: any;
}
