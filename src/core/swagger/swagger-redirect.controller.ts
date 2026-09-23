import { Controller, Get, Redirect } from '@nestjs/common';
import { Public } from '../auth/jwt-auth.guard';

@Controller()
export class SwaggerRedirectController {
    @Public()
    @Get()
    @Redirect('/api/docs', 302)
    redirectToDocs() { }
}