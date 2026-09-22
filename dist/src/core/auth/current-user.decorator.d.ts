import { UserContext } from '../rbac/scope.service';
export declare const CurrentUser: (...dataOrPipes: (keyof UserContext | import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>> | undefined)[]) => ParameterDecorator;
