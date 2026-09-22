import { HttpStatus, Type } from '@nestjs/common';
export interface ApiStandardResponseOptions {
    type?: Type<any>;
    status?: HttpStatus;
    description?: string;
    isPaginated?: boolean;
    isArray?: boolean;
    primitiveType?: 'string' | 'number' | 'boolean' | 'object';
    example?: any;
}
export declare function ApiStandardResponse(options?: ApiStandardResponseOptions): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function ApiStandardErrorResponse(status?: HttpStatus, description?: string, codeExample?: string): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
