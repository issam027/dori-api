import { DoriException } from './dori.exception';

describe('DoriException', () => {
  it('should initialize standard error correctly', () => {
    const ex = new DoriException('QUEUE_NOT_FOUND', { queueId: 42 });
    expect(ex.getStatus()).toBe(404);
    expect(ex.code).toBe('QUEUE_NOT_FOUND');
    expect(ex.translationKey).toBe('errors.queue_not_found');
    expect(ex.translationParams).toEqual({ queueId: 42 });
    expect(ex.payload).toBeNull();
  });

  describe('VALIDATION_ERROR standardization (ERR-01)', () => {
    it('should place payload errors array into data.errors', () => {
      const ex = new DoriException(
        'VALIDATION_ERROR',
        {},
        { errors: ['field is required'] },
      );
      expect(ex.getStatus()).toBe(400);
      const res = ex.getResponse() as any;
      expect(res.code).toBe('VALIDATION_ERROR');
      expect(res.translationKey).toBe('errors.validation_error');
      expect(res.translationParams).toEqual({});
      expect(res.data).toEqual({ errors: ['field is required'] });
    });

    it('should convert message in translationParams into data.errors and clear translationParams', () => {
      const ex = new DoriException('VALIDATION_ERROR', {
        message: 'personId or person object is required',
      });
      expect(ex.getStatus()).toBe(400);
      const res = ex.getResponse() as any;
      expect(res.code).toBe('VALIDATION_ERROR');
      expect(res.translationKey).toBe('errors.validation_error');
      expect(res.translationParams).toEqual({});
      expect(res.data).toEqual({
        errors: ['personId or person object is required'],
      });
    });

    it('should convert errors in translationParams into data.errors', () => {
      const ex = new DoriException('VALIDATION_ERROR', {
        errors: ['invalid value 1', 'invalid value 2'],
      });
      const res = ex.getResponse() as any;
      expect(res.data).toEqual({
        errors: ['invalid value 1', 'invalid value 2'],
      });
      expect(res.translationParams).toEqual({});
    });
  });
});
