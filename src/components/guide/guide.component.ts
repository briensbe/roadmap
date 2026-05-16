import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="guide-page">
      <div class="guide-header">
        <h1>Guide Utilisateur</h1>
        <p class="subtitle">Tout ce qu'il faut savoir pour maîtriser Roadmap</p>
      </div>
      <div class="guide-container">
        <div class="guide-content" [innerHTML]="renderedContent"></div>
      </div>
    </div>
  `,
  styles: [`
    .guide-page {
      padding: 40px 20px;
      max-width: 900px;
      margin: 0 auto;
      animation: fadeIn 0.5s ease-out;
    }

    .guide-header {
      margin-bottom: 40px;
      text-align: center;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 32px;
    }

    .guide-header h1 {
      font-size: 2.5rem;
      font-weight: 800;
      color: #111827;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #4f46e5 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      font-size: 1.1rem;
      color: #6b7280;
    }

    .guide-container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #f3f4f6;
      overflow: hidden;
    }

    .guide-content {
      padding: 40px;
      color: #374151;
      line-height: 1.6;
      font-size: 1.05rem;
    }

    /* Markdown Styles */
    :host ::ng-deep .guide-content h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
      margin-top: 0;
      margin-bottom: 24px;
    }

    :host ::ng-deep .guide-content h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #111827;
      margin-top: 32px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f3f4f6;
    }

    :host ::ng-deep .guide-content h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
      margin-top: 24px;
      margin-bottom: 12px;
    }

    :host ::ng-deep .guide-content p {
      margin-bottom: 16px;
    }

    :host ::ng-deep .guide-content strong {
      color: #111827;
      font-weight: 600;
    }

    :host ::ng-deep .guide-content ul, :host ::ng-deep .guide-content ol {
      margin-bottom: 16px;
      padding-left: 24px;
    }

    :host ::ng-deep .guide-content li {
      margin-bottom: 8px;
    }

    :host ::ng-deep .guide-content blockquote {
      margin: 24px 0;
      padding: 16px 24px;
      background: #f9fafb;
      border-left: 4px solid #4f46e5;
      border-radius: 4px;
      font-style: italic;
      color: #4b5563;
    }

    :host ::ng-deep .guide-content blockquote p {
      margin-bottom: 0;
    }

    :host ::ng-deep .guide-content code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      color: #eb4b4b;
    }

    :host ::ng-deep .guide-content pre {
      background: #111827;
      color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 24px 0;
    }

    :host ::ng-deep .guide-content pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      font-size: 0.95rem;
    }

    :host ::ng-deep .guide-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 0.95rem;
    }

    :host ::ng-deep .guide-content th {
      background: #f9fafb;
      text-align: left;
      padding: 12px 16px;
      border-bottom: 2px solid #e5e7eb;
      color: #4b5563;
      font-weight: 600;
    }

    :host ::ng-deep .guide-content td {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
    }

    :host ::ng-deep .guide-content tr:last-child td {
      border-bottom: none;
    }

    :host ::ng-deep .guide-content hr {
      margin: 40px 0;
      border: 0;
      border-top: 1px solid #e5e7eb;
    }

    /* Details/Summary styling */
    :host ::ng-deep details {
      margin: 24px 0;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
      transition: all 0.2s ease;
    }

    :host ::ng-deep details[open] {
      background: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    :host ::ng-deep summary {
      padding: 16px 20px;
      cursor: pointer;
      font-weight: 600;
      font-size: 1.2rem;
      color: #111827;
      outline: none;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: background-color 0.2s ease;
    }

    :host ::ng-deep summary:hover {
      background-color: #f3f4f6;
    }

    :host ::ng-deep summary::-webkit-details-marker {
      display: none;
    }

    :host ::ng-deep summary::before {
      content: '▶';
      font-size: 0.9rem;
      color: #4f46e5;
      transition: transform 0.2s ease;
      background: #eef2ff;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
    }

    :host ::ng-deep details[open] summary {
      border-bottom: 1px solid #f3f4f6;
      margin-bottom: 16px;
    }

    :host ::ng-deep details[open] summary::before {
      transform: rotate(90deg);
    }

    :host ::ng-deep details .guide-content, 
    :host ::ng-deep details > *:not(summary) {
      padding: 0 16px 16px 16px;
    }

    :host ::ng-deep details table {
       margin-top: 0;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class GuideComponent implements OnInit {
  renderedContent: SafeHtml = '';

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.http.get('assets/guide-roadmap.md', { responseType: 'text' })
      .subscribe({
        next: (markdown) => {
          const html = marked.parse(markdown) as string;
          this.renderedContent = this.sanitizer.bypassSecurityTrustHtml(html);
        },
        error: (err) => {
          console.error('Error loading guide:', err);
          this.renderedContent = this.sanitizer.bypassSecurityTrustHtml('<p>Erreur lors du chargement du guide.</p>');
        }
      });
  }
}
