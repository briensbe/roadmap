import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Settings,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Globe,
  User,
  Shield,
  Type
} from 'lucide-angular';
import { SettingsService } from '../../services/settings.service';
import { Setting, SettingType } from '../../models/settings.type';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="settings-container">
      <header class="settings-header">
        <div class="header-left">
          <lucide-icon [img]="SettingsIcon" class="header-icon"></lucide-icon>
          <div>
            <h1>Paramètres</h1>
            <p class="subtitle">Gérez les configurations globales et spécifiques du système</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="search-bar">
            <lucide-icon [img]="SearchIcon" size="18" class="search-icon"></lucide-icon>
            <input 
              type="text" 
              placeholder="Rechercher une clé..." 
              [(ngModel)]="searchQuery"
              (input)="filterSettings()"
            >
          </div>
          <button class="btn-primary" (click)="openCreateModal()">
            <lucide-icon [img]="PlusIcon" size="18"></lucide-icon>
            Nouveau Paramètre
          </button>
        </div>
      </header>

      <div class="settings-grid">
        <div class="settings-card">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Clé / Scope</th>
                  <th>Valeur</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th class="actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let setting of filteredSettings" class="setting-row">
                  <td>
                    <div class="key-scope">
                      <span class="setting-key">{{ setting.key }}</span>
                      <div class="scope-badge" [class.global]="setting.scope === 'global'">
                        <lucide-icon [img]="setting.scope === 'global' ? GlobeIcon : UserIcon" size="12"></lucide-icon>
                        {{ setting.scope }}
                      </div>
                    </div>
                  </td>
                  <td>
                    <code class="value-preview">{{ setting.value }}</code>
                  </td>
                  <td>
                    <span class="type-tag" [attr.data-type]="setting.type">
                      {{ setting.type }}
                    </span>
                  </td>
                  <td>
                    <span class="description-text">{{ setting.description || '-' }}</span>
                  </td>
                  <td class="actions-cell">
                    <button class="action-btn edit" (click)="editSetting(setting)" title="Modifier">
                      <lucide-icon [img]="EditIcon" size="16"></lucide-icon>
                    </button>
                    <button class="action-btn delete" (click)="deleteSetting(setting)" title="Supprimer">
                      <lucide-icon [img]="TrashIcon" size="16"></lucide-icon>
                    </button>
                  </td>
                </tr>
                <tr *ngIf="filteredSettings.length === 0">
                  <td colspan="5" class="empty-state">
                    <lucide-icon [img]="SearchIcon" size="48"></lucide-icon>
                    <p>Aucun paramètre trouvé</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Add/Edit -->
      <div class="modal-overlay" *ngIf="isModalOpen" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingSetting?.id ? 'Modifier le paramètre' : 'Nouveau paramètre' }}</h2>
            <button class="close-btn" (click)="closeModal()">
              <lucide-icon [img]="XIcon" size="20"></lucide-icon>
            </button>
          </div>
          <form (ngSubmit)="saveSetting()" #settingsForm="ngForm">
            <div class="modal-body">
              <div class="form-group">
                <label for="key">Clé</label>
                <input type="text" id="key" name="key" [(ngModel)]="currentSetting.key" required placeholder="ex: api_timeout">
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="type">Type</label>
                  <select id="type" name="type" [(ngModel)]="currentSetting.type" required>
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="scope">Scope</label>
                  <input type="text" id="scope" name="scope" [(ngModel)]="currentSetting.scope" required placeholder="global">
                </div>
              </div>

              <div class="form-group">
                <label for="value">Valeur</label>
                <textarea 
                  id="value" 
                  name="value" 
                  [(ngModel)]="currentSetting.value" 
                  required 
                  rows="3"
                  [placeholder]="valuePlaceholder"
                ></textarea>
              </div>

              <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" [(ngModel)]="currentSetting.description" rows="2" placeholder="À quoi sert ce paramètre ?"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Annuler</button>
              <button type="submit" class="btn-primary" [disabled]="!settingsForm.form.valid">
                <lucide-icon [img]="SaveIcon" size="18"></lucide-icon>
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      padding: 32px;
      padding-top: 80px;
      background: #f8fafc;
      min-height: 100vh;
      margin-left: 32px;
    }

    .settings-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon {
      padding: 12px;
      background: white;
      border-radius: 12px;
      color: #4f46e5;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .subtitle {
      color: #64748b;
      margin: 4px 0 0 0;
    }

    .header-actions {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .search-bar {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      color: #94a3b8;
    }

    .search-bar input {
      padding: 10px 16px 10px 40px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: white;
      width: 300px;
      font-size: 14px;
      transition: all 0.2s;
    }

    .search-bar input:focus {
      outline: none;
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .btn-primary {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #4f46e5;
      color: white;
      padding: 10px 20px;
      border-radius: 10px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary:hover {
      background: #4338ca;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
    }

    .btn-primary:disabled {
      background: #94a3b8;
      cursor: not-allowed;
      transform: none;
    }

    .settings-grid {
      display: grid;
      gap: 24px;
    }

    .settings-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }

    .table-container {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      background: #f8fafc;
      padding: 16px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #e2e8f0;
    }

    td {
      padding: 16px;
      vertical-align: middle;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      font-size: 14px;
    }

    .setting-row:hover {
      background: #f8fafc;
    }

    .key-scope {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .setting-key {
      font-weight: 600;
      color: #1e293b;
    }

    .scope-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      background: #f1f5f9;
      color: #64748b;
      width: fit-content;
    }

    .scope-badge.global {
      background: #dcfce7;
      color: #166534;
    }

    .value-preview {
      display: inline-block;
      padding: 4px 8px;
      background: #f1f5f9;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #475569;
      overflow: hidden;
    }

    .type-tag {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      text-transform: capitalize;
    }

    .type-tag[data-type="string"] { background: #e0f2fe; color: #0369a1; }
    .type-tag[data-type="number"] { background: #fef3c7; color: #92400e; }
    .type-tag[data-type="boolean"] { background: #ede9fe; color: #5b21b6; }
    .type-tag[data-type="json"] { background: #fae8ff; color: #86198f; }

    .description-text {
      color: #64748b;
      font-size: 13px;
    }

    .actions-cell {
      text-align: right;
      white-space: nowrap;
    }

    .action-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      color: #94a3b8;
    }

    .action-btn:hover {
      background: #f1f5f9;
    }

    .action-btn.edit:hover { color: #4f46e5; }
    .action-btn.delete:hover { color: #ef4444; }

    .empty-state {
      padding: 64px !important;
      text-align: center;
      color: #94a3b8;
    }

    .empty-state p {
      margin-top: 16px;
      font-size: 16px;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      animation: fadeIn 0.2s ease;
    }

    .modal-content {
      background: white;
      border-radius: 20px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .modal-header {
      padding: 24px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
    }

    .close-btn:hover {
      background: #f1f5f9;
      color: #64748b;
    }

    .modal-body {
      padding: 24px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 8px;
    }

    input, select, textarea {
      width: 100%;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      font-size: 14px;
      color: #1e293b;
      transition: all 0.2s;
    }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .modal-footer {
      padding: 24px;
      background: #f8fafc;
      border-bottom-left-radius: 20px;
      border-bottom-right-radius: 20px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn-secondary {
      padding: 10px 20px;
      border-radius: 10px;
      background: white;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-secondary:hover {
      background: #f1f5f9;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class SettingsComponent implements OnInit {
  settings: Setting[] = [];
  filteredSettings: Setting[] = [];
  searchQuery = '';

  isModalOpen = false;
  editingSetting: Setting | null = null;
  currentSetting: Setting = this.getDefaultSetting();

  // Lucide icons
  SettingsIcon = Settings;
  PlusIcon = Plus;
  SearchIcon = Search;
  EditIcon = Edit2;
  TrashIcon = Trash2;
  XIcon = X;
  SaveIcon = Save;
  GlobeIcon = Globe;
  UserIcon = User;

  get valuePlaceholder(): string {
    return this.currentSetting.type === 'json' ? '{ "key": "value" }' : 'Entrez la valeur...';
  }

  constructor(private settingsService: SettingsService) { }

  ngOnInit() {
    this.loadSettings();
  }

  async loadSettings() {
    try {
      this.settings = await this.settingsService.getAllSettings();
      this.filterSettings();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  filterSettings() {
    if (!this.searchQuery) {
      this.filteredSettings = [...this.settings];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredSettings = this.settings.filter(s =>
        s.key.toLowerCase().includes(query) ||
        s.scope.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query))
      );
    }
  }

  getDefaultSetting(): Setting {
    return {
      key: '',
      value: '',
      type: 'string',
      scope: 'global',
      description: ''
    };
  }

  openCreateModal() {
    this.editingSetting = null;
    this.currentSetting = this.getDefaultSetting();
    this.isModalOpen = true;
  }

  editSetting(setting: Setting) {
    this.editingSetting = setting;
    this.currentSetting = { ...setting };
    this.isModalOpen = true;
  }

  async deleteSetting(setting: Setting) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le paramètre "${setting.key}" ?`)) {
      try {
        if (setting.id) {
          await this.settingsService.deleteSetting(setting.id);
          this.loadSettings();
        }
      } catch (error) {
        console.error('Error deleting setting:', error);
      }
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingSetting = null;
  }

  async saveSetting() {
    try {
      if (this.editingSetting?.id) {
        await this.settingsService.updateSetting(this.editingSetting.id, this.currentSetting);
      } else {
        await this.settingsService.createSetting(this.currentSetting);
      }
      this.closeModal();
      this.loadSettings();
    } catch (error) {
      console.error('Error saving setting:', error);
    }
  }
}
