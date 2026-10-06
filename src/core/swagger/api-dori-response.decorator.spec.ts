import { assertPublicResponseDtoName } from './api-dori-response.decorator';

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
