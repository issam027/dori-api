import * as fs from 'fs';
import * as path from 'path';
import {
  assertPublicResponseDtoName,
  ApiDoriNotModifiedResponse,
} from './api-dori-response.decorator';

describe('assertPublicResponseDtoName', () => {
  it.each([
    class PersonResponseDto {},
    class PaginatedPersonResponseDto {},
    class DeletePersonResponseDto {},
    class QueuePreviewItemDto {},
  ])('accepts the public response convention: $name', (dto) => {
    expect(() => assertPublicResponseDtoName(dto)).not.toThrow();
  });

  it('rejects an ambiguous public response name', () => {
    class PersonDetailDto {}

    expect(() => assertPublicResponseDtoName(PersonDetailDto)).toThrow(
      'Invalid public response DTO name "PersonDetailDto"',
    );
  });
});

describe('ApiDoriNotModifiedResponse — CORE-002', () => {
  it('defines a valid 304 response decorator', () => {
    class TestController {
      @ApiDoriNotModifiedResponse('Non modifié')
      testEndpoint() {}
    }
    const metadata = Reflect.getMetadata(
      'swagger/apiResponse',
      TestController.prototype.testEndpoint,
    );
    expect(metadata).toBeDefined();
    expect(metadata['304']).toBeDefined();
    expect(metadata['304'].description).toBe('Non modifié');
  });

  it('ensures no module controller imports ApiResponse directly from @nestjs/swagger', () => {
    const modulesDir = path.resolve(__dirname, '../../modules');
    const files = fs.readdirSync(modulesDir, { recursive: true }) as string[];
    const controllerFiles = files.filter((f) => f.endsWith('.controller.ts'));

    for (const file of controllerFiles) {
      const content = fs.readFileSync(path.join(modulesDir, file), 'utf8');
      expect(content).not.toMatch(
        /import\s+{[^}]*\bApiResponse\b[^}]*}\s+from\s+['"]@nestjs\/swagger['"]/,
      );
    }
  });
});
