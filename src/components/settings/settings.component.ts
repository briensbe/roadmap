import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
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
  Type,
  FileJson,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  HelpCircle,
} from 'lucide-angular';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { SettingsService } from '../../services/settings.service';
import { Setting, SettingType } from '../../models/settings.type';
import { ConfirmModalComponent } from '../confirm-modal.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ConfirmModalComponent],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ height: '0', opacity: 0 }),
        animate('300ms ease-out', style({ height: '*', opacity: 1 })),
      ]),
      transition(':leave', [animate('300ms ease-in', style({ height: '0', opacity: 0 }))]),
    ]),
  ],
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
            <input type="text" placeholder="Rechercher une clé..." [(ngModel)]="searchQuery" />
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
                @if (settingsQuery.isPending()) {
                  <tr>
                    <td colspan="5" class="empty-state">Chargement des paramètres...</td>
                  </tr>
                } @else if (settingsQuery.isError()) {
                  <tr>
                    <td colspan="5" class="empty-state">Erreur lors du chargement des paramètres</td>
                  </tr>
                } @else {
                  @for (setting of filteredSettings(); track setting.id) {
                    <tr class="setting-row">
                      <td>
                        <div class="key-scope">
                          <span class="setting-key">{{ setting.key }}</span>
                          <div class="scope-badge" [class.global]="setting.scope === 'global'">
                            <lucide-icon
                              [img]="setting.scope === 'global' ? GlobeIcon : UserIcon"
                              size="12"></lucide-icon>
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
                  }
                  @if (filteredSettings().length === 0) {
                    <tr>
                      <td colspan="5" class="empty-state">
                        <lucide-icon [img]="SearchIcon" size="48"></lucide-icon>
                        <p>Aucun paramètre trouvé</p>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="tools-section">
        <div class="section-header">
          <lucide-icon [img]="CodeIcon" size="20"></lucide-icon>
          <h2>Outils & Bookmarklets</h2>
        </div>
        <div class="tools-grid">
          <div class="tool-card">
            <div class="tool-main">
              <div class="tool-info">
                <div class="tool-icon-wrapper jira">
                  <lucide-icon [img]="FileJsonIcon" size="24"></lucide-icon>
                </div>
                <div>
                  <h3>Extracteur Jira (Cloud & DataCenter)</h3>
                  <p>
                    Bookmarklet universel pour extraire les données d'un ticket Jira (Cloud ou DataCenter / On-Premise)
                    vers le format JSON compatible.
                  </p>
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-btn" (click)="loadAndToggleCode()">
                  <lucide-icon [img]="showCode() ? ChevronUpIcon : CodeIcon" size="16"></lucide-icon>
                  {{ showCode() ? 'Masquer' : 'Voir le code' }}
                </button>
              </div>
            </div>

            @if (showCode()) {
              <div class="code-preview-container" @slideInOut>
                <div class="code-header">
                  <span class="file-name">extract-jira.js</span>
                  <button class="copy-btn" (click)="copyToClipboard(codeRaw)" [class.success]="copySuccess()">
                    <lucide-icon [img]="copySuccess() ? CheckIcon : CopyIcon" size="14"></lucide-icon>
                    {{ copySuccess() ? 'Copié !' : 'Copier' }}
                  </button>
                </div>
                <div class="code-content" [innerHTML]="codeRendered()"></div>
              </div>
            }
          </div>

          <div class="help-card">
            <button class="help-header" (click)="toggleHelp()">
              <div class="help-title">
                <lucide-icon [img]="HelpCircleIcon" size="20" class="help-icon"></lucide-icon>
                <span>Comment utiliser le bookmarklet ?</span>
              </div>
              <lucide-icon
                [img]="showHelp() ? ChevronUpIcon : ChevronDownIcon"
                size="18"
                class="chevron-icon"></lucide-icon>
            </button>

            @if (showHelp()) {
              <div class="help-content" @slideInOut>
                <div class="steps-list">
                  <!-- Step 1 -->
                  <div class="step-item">
                    <div class="step-header">
                      <span class="step-number">1</span>
                      <h4>Copier le code</h4>
                    </div>
                    <p class="step-text">
                      Cliquez sur le bouton <strong>"Voir le code"</strong> ci-dessus puis sur
                      <strong>"Copier"</strong> pour mettre le script de l'extracteur dans votre presse-papiers.
                    </p>
                    <div class="step-media">
                      <img
                        src="assets/release-notes/2026-06-10-bookmarklet-step1-copycode.gif"
                        alt="Étape 1 : Copier le code" />
                    </div>
                  </div>

                  <!-- Step 2 -->
                  <div class="step-item">
                    <div class="step-header">
                      <span class="step-number">2</span>
                      <h4>Créer le favori (Bookmarklet)</h4>
                    </div>
                    <p class="step-text">
                      Dans la barre de favoris de votre navigateur, créez un nouveau favori. Nommez-le (ex:
                      <code>Extraire Jira</code>) et collez le code copié dans le champ <strong>URL / Adresse</strong>.
                    </p>
                    <div class="step-media">
                      <img
                        src="assets/release-notes/2026-06-10-bookmarklet-step2-createbookmark.gif"
                        alt="Étape 2 : Créer le favori" />
                    </div>
                  </div>

                  <!-- Step 3 -->
                  <div class="step-item">
                    <div class="step-header">
                      <span class="step-number">3</span>
                      <h4>Utiliser le favori sur Jira</h4>
                    </div>
                    <p class="step-text">
                      Rendez-vous sur la page d'un ticket Jira. Cliquez simplement sur votre favori
                      <code>Extraire Jira</code>. Un message confirmera que les données ont été copiées au format JSON.
                    </p>
                    <div class="step-media">
                      <img
                        src="assets/release-notes/2026-06-10-bookmarklet-step3-extractJiraInfosCopy.gif"
                        alt="Étape 3 : Utiliser sur Jira" />
                    </div>
                  </div>

                  <!-- Step 4 -->
                  <div class="step-item">
                    <div class="step-header">
                      <span class="step-number">4</span>
                      <h4>Importer le JSON du projet</h4>
                    </div>
                    <p class="step-text">
                      Revenez sur l'application dans la section Projets, ouvrez la boîte de dialogue d'importation et
                      collez le JSON extrait pour créer ou mettre à jour le projet.
                    </p>
                    <div class="step-media">
                      <img
                        src="assets/release-notes/2026-06-10-bookmarklet-step4-createProject.gif"
                        alt="Étape 4 : Importer le JSON" />
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Modal Add/Edit -->
      @if (isModalOpen) {
        <div class="modal-overlay" (click)="closeModal()">
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
                  <input
                    type="text"
                    id="key"
                    name="key"
                    [(ngModel)]="currentSetting.key"
                    required
                    placeholder="ex: api_timeout" />
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
                    <input
                      type="text"
                      id="scope"
                      name="scope"
                      [(ngModel)]="currentSetting.scope"
                      required
                      placeholder="global" />
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
                    [placeholder]="valuePlaceholder"></textarea>
                </div>

                <div class="form-group">
                  <label for="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    [(ngModel)]="currentSetting.description"
                    rows="2"
                    placeholder="À quoi sert ce paramètre ?"></textarea>
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
      }

      <app-confirm-modal
        [visible]="showConfirmModal"
        [title]="confirmTitle"
        [message]="confirmMessage"
        confirmLabel="Supprimer"
        (confirm)="onConfirmAction()"
        (cancel)="showConfirmModal = false">
      </app-confirm-modal>
    </div>
  `,
  styles: [
    `
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
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

      .type-tag[data-type='string'] {
        background: #e0f2fe;
        color: #0369a1;
      }
      .type-tag[data-type='number'] {
        background: #fef3c7;
        color: #92400e;
      }
      .type-tag[data-type='boolean'] {
        background: #ede9fe;
        color: #5b21b6;
      }
      .type-tag[data-type='json'] {
        background: #fae8ff;
        color: #86198f;
      }

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

      .action-btn.edit:hover {
        color: #4f46e5;
      }
      .action-btn.delete:hover {
        color: #ef4444;
      }

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
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
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

      input,
      select,
      textarea {
        width: 100%;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        font-size: 14px;
        color: #1e293b;
        transition: all 0.2s;
      }

      input:focus,
      select:focus,
      textarea:focus {
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

      .tools-section {
        margin-top: 40px;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        color: #1e293b;
      }

      .section-header h2 {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }

      .tools-grid {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 1000px;
      }

      .tool-card {
        background: white;
        border-radius: 16px;
        padding: 0;
        border: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        transition: all 0.2s;
        overflow: hidden;
      }

      .tool-main {
        padding: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .tool-card:hover {
        border-color: #4f46e5;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
      }

      .tool-info {
        display: flex;
        gap: 16px;
        align-items: center;
      }

      .tool-icon-wrapper {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .tool-icon-wrapper.jira {
        background: #eff6ff;
        color: #3b82f6;
      }

      .tool-info h3 {
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 4px 0;
      }

      .tool-info p {
        font-size: 13px;
        color: #64748b;
        margin: 0;
        max-width: 600px;
        line-height: 1.4;
      }

      .tool-actions {
        display: flex;
        gap: 12px;
      }

      .tool-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        color: #4f46e5;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .tool-btn:hover {
        background: #f1f5f9;
        border-color: #4f46e5;
      }

      .code-preview-container {
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        overflow: hidden;
      }

      .code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      .file-name {
        color: #64748b;
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      .copy-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        background: white;
        border: 1px solid #e2e8f0;
        color: #64748b;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .copy-btn:hover {
        background: #f1f5f9;
        color: #1e293b;
      }

      .copy-btn.success {
        border-color: #22c55e;
        color: #22c55e;
        background: #f0fdf4;
      }

      .code-content {
        max-height: 400px;
        overflow-y: auto;
        padding: 20px;
        background: #fafafa;
      }

      :host ::ng-deep .code-content pre {
        margin: 0;
        background: transparent;
      }

      :host ::ng-deep .code-content code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        line-height: 1.6;
        color: #334155;
      }

      /* Highlight.js Light Theme (Atom One Light inspired) */
      :host ::ng-deep .hljs-comment,
      :host ::ng-deep .hljs-quote {
        color: #a0a1a7;
        font-style: italic;
      }
      :host ::ng-deep .hljs-doctag,
      :host ::ng-deep .hljs-keyword,
      :host ::ng-deep .hljs-formula {
        color: #a626a4;
      }
      :host ::ng-deep .hljs-section,
      :host ::ng-deep .hljs-name,
      :host ::ng-deep .hljs-selector-tag,
      :host ::ng-deep .hljs-deletion,
      :host ::ng-deep .hljs-subst {
        color: #e45649;
      }
      :host ::ng-deep .hljs-literal {
        color: #0184a3;
      }
      :host ::ng-deep .hljs-string,
      :host ::ng-deep .hljs-regexp,
      :host ::ng-deep .hljs-addition,
      :host ::ng-deep .hljs-attribute,
      :host ::ng-deep .hljs-meta-string {
        color: #50a14f;
      }
      :host ::ng-deep .hljs-built_in,
      :host ::ng-deep .hljs-class .hljs-title {
        color: #c18401;
      }
      :host ::ng-deep .hljs-attr,
      :host ::ng-deep .hljs-variable,
      :host ::ng-deep .hljs-template-variable,
      :host ::ng-deep .hljs-type,
      :host ::ng-deep .hljs-selector-class,
      :host ::ng-deep .hljs-selector-attr,
      :host ::ng-deep .hljs-selector-pseudo,
      :host ::ng-deep .hljs-number {
        color: #986801;
      }
      :host ::ng-deep .hljs-symbol,
      :host ::ng-deep .hljs-bullet,
      :host ::ng-deep .hljs-link,
      :host ::ng-deep .hljs-meta,
      :host ::ng-deep .hljs-selector-id,
      :host ::ng-deep .hljs-title {
        color: #4078f2;
      }
      :host ::ng-deep .hljs-emphasis {
        font-style: italic;
      }
      :host ::ng-deep .hljs-strong {
        font-weight: bold;
      }
      :host ::ng-deep .hljs-link {
        text-decoration: underline;
      }

      /* Help FAQ Section */
      .help-card {
        background: white;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        overflow: hidden;
        margin-top: 16px;
        transition: all 0.2s;
      }
      .help-card:hover {
        border-color: #cbd5e1;
      }
      .help-header {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: background 0.2s;
      }
      .help-header:hover {
        background: #f8fafc;
      }
      .help-title {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
      }
      .help-icon {
        color: #4f46e5;
      }
      .chevron-icon {
        color: #64748b;
      }
      .help-content {
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
        padding: 24px;
      }
      .steps-list {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .step-item {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .step-header {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .step-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: #eff6ff;
        color: #2563eb;
        font-size: 13px;
        font-weight: 700;
        border-radius: 50%;
      }
      .step-header h4 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #1e293b;
      }
      .step-text {
        margin: 0;
        font-size: 13px;
        color: #64748b;
        line-height: 1.5;
      }
      .step-text code {
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: ui-monospace, monospace;
        font-size: 12px;
        color: #475569;
      }
      .step-media {
        margin-top: 12px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #f1f5f9;
        background: #f8fafc;
        max-width: 600px;
        width: 100%;
        align-self: flex-start;
      }
      .step-media img {
        width: 100%;
        height: auto;
        display: block;
        object-fit: cover;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  // Tools state
  showCode = signal(false);
  showHelp = signal(false);
  codeRaw = '';
  codeRendered = signal<SafeHtml>('');
  copySuccess = signal(false);

  searchQuery = signal('');
  settingsQuery = this.settingsService.getAllSettingsQuery();
  createSettingMutation = this.settingsService.createSettingMutation();
  updateSettingMutation = this.settingsService.updateSettingMutation();
  deleteSettingMutation = this.settingsService.deleteSettingMutation();

  filteredSettings = computed(() => {
    const settings = this.settingsQuery.data() || [];
    const query = this.searchQuery().toLowerCase();

    if (!query) return settings;

    return settings.filter(
      (s: Setting) =>
        s.key.toLowerCase().includes(query) ||
        s.scope.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query)),
    );
  });

  isModalOpen = false;
  editingSetting: Setting | null = null;
  currentSetting: Setting = this.getDefaultSetting();

  // Confirm Modal state
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  private pendingConfirmAction: (() => void) | null = null;

  onConfirmAction() {
    if (this.pendingConfirmAction) {
      this.pendingConfirmAction();
    }
    this.showConfirmModal = false;
  }

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
  FileJsonIcon = FileJson;
  CopyIcon = Copy;
  CheckIcon = Check;
  ChevronUpIcon = ChevronUp;
  ChevronDownIcon = ChevronDown;
  CodeIcon = Code;
  HelpCircleIcon = HelpCircle;

  toggleHelp() {
    this.showHelp.update((h) => !h);
  }

  get valuePlaceholder(): string {
    return this.currentSetting.type === 'json' ? '{ "key": "value" }' : 'Entrez la valeur...';
  }

  ngOnInit() {
    // Configure marked with highlight.js
    marked.use(
      markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        },
      }),
    );
  }

  loadAndToggleCode() {
    if (this.showCode()) {
      this.showCode.set(false);
      return;
    }

    if (this.codeRaw) {
      this.showCode.set(true);
      return;
    }

    this.http.get('assets/scripts/extract-jira-bookmarklet.js', { responseType: 'text' }).subscribe((code) => {
      this.codeRaw = code;
      const markdown = '```javascript\n' + code + '\n```';
      this.codeRendered.set(this.sanitizer.bypassSecurityTrustHtml(marked.parse(markdown) as string));
      this.showCode.set(true);
    });
  }

  async copyToClipboard(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }

  getDefaultSetting(): Setting {
    return {
      key: '',
      value: '',
      type: 'string',
      scope: 'global',
      description: '',
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
    this.confirmTitle = 'Supprimer le paramètre';
    this.confirmMessage = `Êtes-vous sûr de vouloir supprimer le paramètre "${setting.key}" ?`;

    this.pendingConfirmAction = () => {
      if (setting.id) {
        this.deleteSettingMutation.mutate(setting.id);
      }
    };
    this.showConfirmModal = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingSetting = null;
  }

  async saveSetting() {
    if (this.editingSetting?.id) {
      this.updateSettingMutation.mutate(
        {
          id: this.editingSetting.id,
          setting: this.currentSetting,
        },
        {
          onSuccess: () => this.closeModal(),
        },
      );
    } else {
      this.createSettingMutation.mutate(this.currentSetting, {
        onSuccess: () => this.closeModal(),
      });
    }
  }
}
