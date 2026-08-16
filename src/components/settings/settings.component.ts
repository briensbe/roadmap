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
  Globe,
  User,
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
import { Setting } from '../../models/settings.type';
import { ConfirmModalComponent } from '../confirm-modal.component';
import { textContains } from '../../utils/text.utils';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ConfirmModalComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ height: '0', opacity: 0 }),
        animate('300ms ease-out', style({ height: '*', opacity: 1 })),
      ]),
      transition(':leave', [animate('300ms ease-in', style({ height: '0', opacity: 0 }))]),
    ]),
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
    const query = this.searchQuery();

    if (!query) return settings;

    return settings.filter(
      (s: Setting) =>
        textContains(s.key, query) ||
        textContains(s.scope, query) ||
        textContains(s.description, query),
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
