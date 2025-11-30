import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class SidebarService {
    private collapsedSubject = new BehaviorSubject<boolean>(false);
    collapsed$ = this.collapsedSubject.asObservable();

    toggle() {
        this.collapsedSubject.next(!this.collapsedSubject.value);
    }

    setCollapsed(collapsed: boolean) {
        this.collapsedSubject.next(collapsed);
    }

    isCollapsed(): boolean {
        return this.collapsedSubject.value;
    }
}
