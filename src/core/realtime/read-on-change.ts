import { Observable } from 'rxjs';

/** Serialize reads and retain one trailing invalidation during a read. No lost update or unbounded queue. */
export function readOnChange<T, TChange>(
  changes: Observable<TChange>,
  read: (change?: TChange) => Promise<T>,
): Observable<T> {
  return new Observable<T>((subscriber) => {
    let running = false;
    let dirty = false;
    let pending: TChange | undefined;
    const refresh = async (change?: TChange): Promise<void> => {
      pending = change;
      dirty = true;
      if (running) return;
      running = true;
      try {
        while (dirty && !subscriber.closed) {
          dirty = false;
          const next = pending;
          pending = undefined;
          subscriber.next(await read(next));
        }
      } catch (error) {
        subscriber.error(error);
      } finally {
        running = false;
      }
    };
    // Subscribe before the snapshot so an update committed during the read is retained.
    const subscription = changes.subscribe({
      next: (change) => {
        void refresh(change);
      },
      error: (error: unknown) => subscriber.error(error),
    });
    void refresh();
    return () => subscription.unsubscribe();
  });
}
