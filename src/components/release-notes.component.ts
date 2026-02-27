import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface ReleaseNote {
    version: string;
    date: string;
    title: string;
    items: string[];
}

@Component({
    selector: 'app-release-notes',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div *ngIf="show" class="release-notes-overlay">
      <div class="release-notes-card">
        <div class="header">
          <h3>{{ notes?.title }}</h3>
          <button (click)="close()" class="close-btn">&times;</button>
        </div>
        <div class="content">
          <p class="date">{{ notes?.date | date:'longDate' }} - Version {{ notes?.version }}</p>
          <ul>
            <li *ngFor="let item of notes?.items">{{ item }}</li>
          </ul>
        </div>
        <div class="footer">
          <button (click)="dontShowAgain()" class="secondary-btn">Ne plus afficher</button>
          <button (click)="close()" class="primary-btn">Fermer</button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .release-notes-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
    }
    .release-notes-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 450px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: slideUp 0.3s ease-out;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
    }
    .header h3 {
      margin: 0;
      color: #333;
      font-size: 1.25rem;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #999;
    }
    .content {
      margin-bottom: 24px;
    }
    .date {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 12px;
    }
    ul {
      margin: 0;
      padding-left: 20px;
      color: #444;
    }
    li {
      margin-bottom: 8px;
    }
    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    button {
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    .primary-btn {
      background: #007bff;
      color: white;
      border: none;
    }
    .primary-btn:hover {
      background: #0056b3;
    }
    .secondary-btn {
      background: #f8f9fa;
      color: #666;
      border: 1px solid #ddd;
    }
    .secondary-btn:hover {
      background: #e2e6ea;
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class ReleaseNotesComponent implements OnInit {
    notes: ReleaseNote | null = null;
    show = false;
    private readonly STORAGE_KEY = 'last_seen_release_version';

    constructor(private http: HttpClient) { }

    ngOnInit() {
        this.http.get<ReleaseNote>('assets/release-notes.json').subscribe({
            next: (data) => {
                this.notes = data;
                this.checkVisibility();
            },
            error: (err) => console.error('Error loading release notes:', err)
        });
    }

    private checkVisibility() {
        if (!this.notes) return;
        const lastSeenVersion = localStorage.getItem(this.STORAGE_KEY);
        if (lastSeenVersion !== this.notes.version) {
            this.show = true;
        }
    }

    close() {
        this.show = false;
    }

    dontShowAgain() {
        if (this.notes) {
            localStorage.setItem(this.STORAGE_KEY, this.notes.version);
        }
        this.close();
    }
}
