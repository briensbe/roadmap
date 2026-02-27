import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReleaseNotesService } from '../services/release-notes.service';
import { Subscription } from 'rxjs';

interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  imageUrl?: string;
  items: string[];
}

@Component({
  selector: 'app-release-notes',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (show) {
      <div class="release-notes-overlay">
        <div class="release-notes-card" [class.history-mode]="showHistory">
          <div class="header">
            <h3>{{ showHistory ? 'Historique des versions' : notes[0]?.title }}</h3>
            <button (click)="close()" class="close-btn">&times;</button>
          </div>
          
          <div class="content" [class.history-list]="showHistory">
            @if (!showHistory) {
              <!-- Latest Version View -->
              <div class="latest-update">
                <p class="date">{{ notes[0]?.date | date:'longDate' }} - Version {{ notes[0]?.version }}</p>
                
                
                <ul>
                  @for (item of notes[0]?.items; track item) {
                    <li>{{ item }}</li>
                  }
                </ul>
                @if (notes[0]?.imageUrl) {
                  <div class="image-container">
                    <img [src]="notes[0].imageUrl" [alt]="notes[0].title" class="release-image">
                  </div>
                }
              </div>
            } @else {
              <!-- History View -->
              @for (note of notes; track note.version) {
                <div class="history-item">
                  <h4 class="history-title">{{ note.title }}</h4>
                  <p class="date">{{ note.date | date:'longDate' }} - Version {{ note.version }}</p>
                  
                  
                  <ul>
                    @for (item of note.items; track item) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                  @if (note.imageUrl) {
                    <div class="image-container mini">
                      <img [src]="note.imageUrl" [alt]="note.title" class="release-image">
                    </div>
                  }
                </div>
              }
            }
          </div>

          <div class="footer">
            @if (!showHistory) {
              <button (click)="toggleHistory()" class="secondary-btn">Voir l'historique</button>
            }
            <div class="actions">
               @if (!showHistory) {
                 <button (click)="dontShowAgain()" class="secondary-btn">Ne plus afficher</button>
               }
               <button (click)="close()" class="primary-btn">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    }
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
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: slideUp 0.3s ease-out;
      transition: max-width 0.3s ease;
    }
    .release-notes-card.history-mode {
       max-width: 600px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
      flex-shrink: 0;
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
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .history-list {
       padding-right: 8px;
    }
    
    .image-container {
      margin: 12px 0 20px 0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      border: 1px solid #f0f0f0;
      line-height: 0;
    }
    .image-container.mini {
      max-width: 300px;
      margin: 12px 0;
    }
    .release-image {
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.3s ease;
    }
    .release-image:hover {
      transform: scale(1.02);
    }

    /* Scrollbar styling for history */
    .content::-webkit-scrollbar {
      width: 6px;
    }
    .content::-webkit-scrollbar-track {
      background: transparent;
    }
    .content::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }
    .content::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }
    .history-item {
       margin-bottom: 24px;
       padding-bottom: 16px;
       border-bottom: 1px dashed #eee;
    }
    .history-item:last-child {
       margin-bottom: 0;
       padding-bottom: 0;
       border-bottom: none;
    }
    .history-title {
       margin: 0 0 8px 0;
       font-size: 1.1rem;
       color: #4f46e5;
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
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      padding-top: 10px;
    }
    .actions {
       display: flex;
       gap: 12px;
       justify-content: flex-end;
       flex: 1;
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
export class ReleaseNotesComponent implements OnInit, OnDestroy {
  notes: ReleaseNote[] = [];
  private _show = false;
  get show() { return this._show; }
  set show(value: boolean) {
    this._show = value;
    if (value) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
  showHistory = false;
  private readonly STORAGE_KEY = 'last_seen_release_version';
  private subscription: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private releaseNotesService: ReleaseNotesService
  ) { }

  ngOnInit() {
    this.http.get<ReleaseNote[]>('assets/release-notes.json').subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.notes = data;
          this.checkVisibility();
        }
      },
      error: (err) => console.error('Error loading release notes:', err)
    });

    this.subscription = this.releaseNotesService.showNotes$.subscribe((show) => {
      if (show && this.notes.length > 0) {
        this.showHistory = true;
        this.show = true;
      }
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    document.body.style.overflow = '';
  }

  private checkVisibility() {
    if (this.notes.length === 0) return;
    const latestVersion = this.notes[0].version;
    const lastSeenVersion = localStorage.getItem(this.STORAGE_KEY);

    if (lastSeenVersion !== latestVersion) {
      this.showHistory = false;
      this.show = true;
    }
  }

  toggleHistory() {
    this.showHistory = !this.showHistory;
  }

  close() {
    this.show = false;
    // Reset history view for the next time it opens
    setTimeout(() => this.showHistory = false, 300);
  }

  dontShowAgain() {
    if (this.notes.length > 0) {
      localStorage.setItem(this.STORAGE_KEY, this.notes[0].version);
    }
    this.close();
  }
}
