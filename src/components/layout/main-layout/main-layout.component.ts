import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarNavigationComponent } from '../../sidebar-navigation.component';
import { SidebarService } from '../../../services/sidebar.service';
import { ReleaseNotesComponent } from '../../release-notes.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarNavigationComponent, ReleaseNotesComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit {
  sidebarCollapsed = false;
  protected readonly sidebarService = inject(SidebarService);

  ngOnInit(): void {
    this.sidebarService.collapsed$.subscribe((collapsed) => {
      this.sidebarCollapsed = collapsed;
    });
  }
}
