import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guide.component.html',
  styleUrl: './guide.component.css',
})
export class GuideComponent implements OnInit {
  renderedContent: SafeHtml = '';

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    this.http.get('assets/guide-roadmap.md', { responseType: 'text' }).subscribe({
      next: (markdown) => {
        const html = marked.parse(markdown) as string;
        this.renderedContent = this.sanitizer.bypassSecurityTrustHtml(html);
      },
      error: (err) => {
        console.error('Error loading guide:', err);
        this.renderedContent = this.sanitizer.bypassSecurityTrustHtml('<p>Erreur lors du chargement du guide.</p>');
      },
    });
  }
}
