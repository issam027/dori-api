export declare class PaginationQueryDto {
    page: number;
    pageSize: number;
    sort?: string;
    get skip(): number;
    get take(): number;
}
export interface PaginatedResult<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}
export declare function buildPaginatedResult<T>(items: T[], total: number, page: number, pageSize: number): PaginatedResult<T>;
