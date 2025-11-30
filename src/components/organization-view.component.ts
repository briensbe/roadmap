import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResourceService } from '../services/resource.service';
import { Societe, Departement, Service, Equipe } from '../models/types';

@Component({
    selector: 'app-organization-view',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="organization-view">
      <!-- Header -->
      <header class="header">
        <div class="header-left">
          <div class="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#3b82f6"/>
              <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="#3b82f6" opacity="0.6"/>
            </svg>
            <span class="logo-text">ResourceFlow</span>
          </div>
        </div>
        <div class="header-right">
          <button class="header-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Société
          </button>
          <button class="header-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            Département
          </button>
          <button class="header-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
            </svg>
            Service
          </button>
          <button class="header-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Équipe
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="main-content">
        <h1 class="page-title">Organisation</h1>
        <p class="page-subtitle">Structurez votre organisation</p>

        <!-- Organization Structure Section -->
        <section class="org-structure">
          <div class="section-header">
            <h2>Structure organisationnelle</h2>
          </div>

          <div class="company-list">
            <div *ngFor="let societe of societes" class="company-card">
              <div class="company-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" fill="#3b82f6" opacity="0.2"/>
                  <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="#3b82f6" stroke-width="2"/>
                </svg>
              </div>
              <div class="company-info">
                <span class="company-name">{{ societe.nom }}</span>
                <span class="company-tag">PRO</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Statistics Cards -->
        <section class="stats-section">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon societes-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#3b82f6" stroke-width="2"/>
                  <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="#3b82f6" stroke-width="2"/>
                </svg>
              </div>
              <div class="stat-value">{{ societes.length }}</div>
              <div class="stat-label">Sociétés</div>
            </div>

            <div class="stat-card">
              <div class="stat-icon departements-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke="#8b5cf6" stroke-width="2"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke="#8b5cf6" stroke-width="2"/>
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke="#8b5cf6" stroke-width="2"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke="#8b5cf6" stroke-width="2"/>
                </svg>
              </div>
              <div class="stat-value">{{ departements.length }}</div>
              <div class="stat-label">Départements</div>
            </div>

            <div class="stat-card">
              <div class="stat-icon services-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#10b981" stroke-width="2" stroke-linejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="#10b981" stroke-width="2" stroke-linejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="#10b981" stroke-width="2" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="stat-value">{{ services.length }}</div>
              <div class="stat-label">Services</div>
            </div>

            <div class="stat-card">
              <div class="stat-icon equipes-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="9" cy="7" r="4" stroke="#f59e0b" stroke-width="2"/>
                  <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="#f59e0b" stroke-width="2"/>
                  <circle cx="17" cy="7" r="2" stroke="#f59e0b" stroke-width="2"/>
                  <path d="M21 21v-2a4 4 0 0 0-3-3.87" stroke="#f59e0b" stroke-width="2"/>
                </svg>
              </div>
              <div class="stat-value">{{ equipes.length }}</div>
              <div class="stat-label">Équipes</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `,
    styles: [`
    .organization-view {
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
    }

    /* Header */
    .header {
      background: white;
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-text {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-right {
      display: flex;
      gap: 12px;
    }

    .header-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: transparent;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #6b7280;
      transition: all 0.2s ease;
    }

    .header-btn:hover {
      background: #f9fafb;
      border-color: #3b82f6;
      color: #3b82f6;
    }

    .header-btn svg {
      stroke-width: 2;
    }

    /* Main Content */
    .main-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 32px;
    }

    .page-title {
      font-size: 32px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 8px 0;
    }

    .page-subtitle {
      font-size: 16px;
      color: #6b7280;
      margin: 0 0 40px 0;
    }

    /* Organization Structure Section */
    .org-structure {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 32px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      margin-bottom: 20px;
    }

    .section-header h2 {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }

    .company-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .company-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .company-card:hover {
      background: #f3f4f6;
      border-color: #3b82f6;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    }

    .company-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .company-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .company-name {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }

    .company-tag {
      padding: 4px 8px;
      background: #dbeafe;
      color: #3b82f6;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    /* Statistics Section */
    .stats-section {
      margin-top: 32px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
    }

    .stat-card {
      background: white;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .stat-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease;
    }

    .stat-card:hover .stat-icon {
      transform: scale(1.1);
    }

    .societes-icon {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    }

    .departements-icon {
      background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
    }

    .services-icon {
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    }

    .equipes-icon {
      background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
    }

    .stat-value {
      font-size: 48px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
      line-height: 1;
    }

    .stat-label {
      font-size: 16px;
      font-weight: 500;
      color: #6b7280;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }

      .header-right {
        width: 100%;
        flex-wrap: wrap;
      }

      .header-btn {
        flex: 1;
        min-width: calc(50% - 6px);
        justify-content: center;
      }

      .main-content {
        padding: 24px 16px;
      }

      .page-title {
        font-size: 24px;
      }

      .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
      }

      .stat-card {
        padding: 24px 16px;
      }

      .stat-icon {
        width: 48px;
        height: 48px;
      }

      .stat-icon svg {
        width: 24px;
        height: 24px;
      }

      .stat-value {
        font-size: 36px;
      }
    }
  `]
})
export class OrganizationViewComponent implements OnInit {
    societes: Societe[] = [];
    departements: Departement[] = [];
    services: Service[] = [];
    equipes: Equipe[] = [];

    constructor(private resourceService: ResourceService) { }

    async ngOnInit() {
        await this.loadData();
    }

    async loadData() {
        try {
            this.societes = await this.resourceService.getAllSocietes();
            this.departements = await this.resourceService.getAllDepartements();
            this.services = await this.resourceService.getAllServices();
            this.equipes = await this.resourceService.getAllEquipes();
        } catch (error) {
            console.error('Error loading organization data:', error);
        }
    }
}
