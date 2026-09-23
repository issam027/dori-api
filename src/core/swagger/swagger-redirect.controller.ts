import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class SwaggerRedirectController {
    @Get()
    @Redirect('/api/docs', 302)
    redirectToDocs() { }
}