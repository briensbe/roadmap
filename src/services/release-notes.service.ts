import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ReleaseNotesService {
  private showNotesSource = new Subject<boolean>();

  // Observable that the component will subscribe to
  showNotes$ = this.showNotesSource.asObservable();

  constructor() {}

  /**
   * Triggers the release notes popup to open in history mode.
   */
  openNotes() {
    this.showNotesSource.next(true);
  }
}
