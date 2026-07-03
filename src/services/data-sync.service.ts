import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Service to synchronize data changes across multiple services that might cache overlapping data.
 * This avoids circular dependencies while ensuring all caches are invalidated when data changes.
 */
@Injectable({
  providedIn: 'root',
})
export class DataSyncService {
  private syncSubject = new Subject<string>();

  /**
   * Observable that emits the name of the entity/table that was changed.
   */
  public sync$ = this.syncSubject.asObservable();

  /**
   * Notify that an entity or team-related data has changed.
   * @param entity The name of the entity or 'all' to clear everything.
   */
  notifyChange(entity: string = 'all') {
    this.syncSubject.next(entity);
  }
}
