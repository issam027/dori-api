import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
export declare const RESPONSE_MESSAGE_KEY = "response_message_key";
export declare const ResponseMessage: (translationKey: string, translationParams?: Record<string, any>) => import("@nestjs/common").CustomDecorator<string>;
export interface StandardResponse<T> {
    code: string;
    translationKey: string | null;
    translationParams: Record<string, any>;
    data: T;
}
export declare class TransformResponseInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
    private readonly reflector;
    constructor(reflector: Reflector);
    intercept(context: ExecutionContext, next: CallHandler): Observable<StandardResponse<T>>;
}
