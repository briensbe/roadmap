import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EasterEggService {
  private triggerSource = new Subject<void>();
  trigger$ = this.triggerSource.asObservable();

  trigger() {
    this.triggerSource.next();
  }
}
