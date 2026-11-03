import { Subject } from 'rxjs';
import { readOnChange } from './read-on-change';

describe('readOnChange', () => {
  it('retains a commit during an in-flight read and bounds a burst to one trailing read', async () => {
    const changes = new Subject<void>();
    let resolve!: (value: number) => void;
    const read = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(2);
    const next = jest.fn();
    const subscription = readOnChange(changes, read).subscribe(next);
    for (let index = 0; index < 100; index++) changes.next();
    expect(read).toHaveBeenCalledTimes(1);
    resolve(1);
    await new Promise<void>((done) => setImmediate(done));
    expect(read).toHaveBeenCalledTimes(2);
    expect(next.mock.calls).toEqual([[1], [2]]);
    subscription.unsubscribe();
    changes.next();
    expect(read).toHaveBeenCalledTimes(2);
  });
});
