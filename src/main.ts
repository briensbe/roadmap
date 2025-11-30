import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { CalendarViewComponent } from './components/calendar-view.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CalendarViewComponent],
  template: `
    <app-calendar-view></app-calendar-view>
  `,
})
export class App {}

bootstrapApplication(App);
