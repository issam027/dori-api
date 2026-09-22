export declare class HealthServicesStatusDto {
    database: string;
    api: string;
}
export declare class HealthResponseDto {
    status: string;
    timestamp: string;
    services: HealthServicesStatusDto;
}
