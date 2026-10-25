import { Component, input, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Search,
  ChevronDown,
  Share2,
  SquarePlus,
  SquareMinus,
  Check,
  Copy,
  TrendingUp,
  TrendingDown,
  Clipboard,
  FileSpreadsheet,
  Download,
} from 'lucide-angular';
import * as XLSX from 'xlsx';
import {
  ImportAnomaliesGroupedProject,
  ImportAnomaliesStats,
  ImportAnomaliesPmGroup,
} from '../../import-view.models';

@Component({
  selector: 'app-import-anomalies-table',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './import-anomalies-table.component.html',
  styleUrl: './import-anomalies-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportAnomaliesTableComponent {
  // Inputs
  readonly groupedProjects = input<ImportAnomaliesGroupedProject[]>([]);
  readonly anomaliesStats = input<ImportAnomaliesStats>({ total: 0, consumed: 0, revision: 0 });
  readonly showStats = input<boolean>(false);
  readonly searchQuery = input<string>('');
  readonly anomalyFilters = input<string[]>([]);
  readonly serviceFilter = input<string>('all');
  readonly filterServices = input<string[]>([]);
  readonly expandedProjectKeys = input<Set<string>>(new Set());
  readonly copiedCodes = input<Set<string>>(new Set());

  // Outputs vers le parent
  readonly searchQueryChange = output<string>();
  readonly anomalyFilterToggle = output<string>();
  readonly serviceFilterChange = output<string>();
  readonly expandAll = output<void>();
  readonly collapseAll = output<void>();
  readonly toggleProjectExpansion = output<string>();
  readonly copyCode = output<{ event: MouseEvent; code: string }>();

  // État interne pour UI du composant
  readonly showAnomalyDropdown = signal<boolean>(false);
  readonly showExportModal = signal<boolean>(false);
  readonly copiedExportText = signal<boolean>(false);
  readonly copiedPmCode = signal<string | null>(null);

  // Icônes
  readonly AlertTriangle = AlertTriangle;
  readonly AlertOctagon = AlertOctagon;
  readonly RefreshCw = RefreshCw;
  readonly Search = Search;
  readonly ChevronDown = ChevronDown;
  readonly Share2 = Share2;
  readonly SquarePlus = SquarePlus;
  readonly SquareMinus = SquareMinus;
  readonly Check = Check;
  readonly Copy = Copy;
  readonly TrendingUp = TrendingUp;
  readonly TrendingDown = TrendingDown;
  readonly Clipboard = Clipboard;
  readonly FileSpreadsheet = FileSpreadsheet;
  readonly Download = Download;

  isProjectExpanded(projectKey: string): boolean {
    return this.expandedProjectKeys().has(projectKey);
  }

  getServiceColorStyle(serviceName: string): { [key: string]: string } {
    let hash = 0;
    for (let i = 0; i < serviceName.length; i++) {
      hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return {
      'background-color': `hsl(${h}, 70%, 93%)`,
      color: `hsl(${h}, 75%, 25%)`,
      border: `1px solid hsl(${h}, 60%, 80%)`,
    };
  }

  readonly anomaliesByPm = computed<ImportAnomaliesPmGroup[]>(() => {
    const projects = this.groupedProjects();
    const pmGroups: { [pmName: string]: ImportAnomaliesGroupedProject[] } = {};

    projects.forEach(proj => {
      const anomalousServices = proj.services.filter(s => s.hasConsumedAnomaly || s.hasRevisionAnomaly);
      if (anomalousServices.length > 0) {
        const pm = proj.project_manager ? proj.project_manager.trim() : 'Sans Chef de Projet';
        if (!pmGroups[pm]) {
          pmGroups[pm] = [];
        }
        pmGroups[pm].push({
          ...proj,
          services: anomalousServices,
        });
      }
    });

    return Object.keys(pmGroups)
      .map(pm => ({
        pm,
        projects: pmGroups[pm],
        totalAlerts: pmGroups[pm].reduce((acc, curr) => acc + curr.services.length, 0),
      }))
      .sort((a, b) => a.pm.localeCompare(b.pm));
  });

  generateIndividualReportMarkdown(pmName: string): string {
    const pmGroup = this.anomaliesByPm().find(g => g.pm === pmName);
    if (!pmGroup) return '';

    let text = `Bonjour ${pmName === 'Sans Chef de Projet' ? '' : pmGroup.pm},\n`;
    text += `Voici un récapitulatif des alertes/écarts budgétaires constatés sur tes projets (Import Triskell) :\n\n`;

    pmGroup.projects.forEach(proj => {
      const jiraStr = proj.jira_references && proj.jira_references.length > 0 ? ` [${proj.jira_references.join(', ')}]` : '';
      text += `*Projet : ${proj.project_code} - ${proj.project_name}*${jiraStr}\n`;
      proj.services.forEach(srv => {
        text += `  - *${srv.service_name}* :`;
        if (srv.hasConsumedAnomaly) {
          text += ` ⚠️ Dépassement consommé de +${srv.consumedGap.toFixed(1)} JH (Consommé : ${(srv.consomme_jh ?? 0).toFixed(1)} JH vs Prév : ${(srv.previsionnel_jh ?? 0).toFixed(1)} JH)\n`;
        }
        if (srv.hasRevisionAnomaly) {
          const sign = srv.revisionGap > 0 ? '+' : '';
          text += ` 🔄 Écart révision de ${sign}${srv.revisionGap.toFixed(1)} JH (Prév : ${(srv.previsionnel_jh ?? 0).toFixed(1)} JH vs Révisé : ${(srv.revised_jh ?? 0).toFixed(1)} JH)\n`;
        }
      });
      text += `\n`;
    });

    text += `Merci de vérifier ces écarts dans l'outil Roadmap ou Triskell.`;
    return text;
  }

  generateGlobalReportMarkdown(): string {
    const groups = this.anomaliesByPm();
    if (groups.length === 0) return 'Aucune anomalie détectée ou filtrée.';

    let text = `*RAPPORT DES ANOMALIES BUDGÉTAIRES TRISKELL*\n`;
    text += `Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}\n`;
    text += `Nombre de collaborateurs concernés : ${groups.length}\n`;
    text += `--------------------------------------------------\n\n`;

    groups.forEach(g => {
      text += `👤 *Chef de projet : ${g.pm}* (${g.totalAlerts} alerte(s))\n`;
      text += `==================================================\n`;
      g.projects.forEach(proj => {
        const jiraStr = proj.jira_references && proj.jira_references.length > 0 ? ` [${proj.jira_references.join(', ')}]` : '';
        text += `• *Projet : ${proj.project_code} - ${proj.project_name}*${jiraStr}\n`;
        proj.services.forEach(srv => {
          if (srv.hasConsumedAnomaly) {
            text += `  - [${srv.service_name}] ⚠️ Dépassement : +${srv.consumedGap.toFixed(1)} JH (Consommé : ${(srv.consomme_jh ?? 0).toFixed(1)} JH vs Prév : ${(srv.previsionnel_jh ?? 0).toFixed(1)} JH)\n`;
          }
          if (srv.hasRevisionAnomaly) {
            const sign = srv.revisionGap > 0 ? '+' : '';
            text += `  - [${srv.service_name}] 🔄 Écart Révision : ${sign}${srv.revisionGap.toFixed(1)} JH (Prév : ${(srv.previsionnel_jh ?? 0).toFixed(1)} JH vs Révisé : ${(srv.revised_jh ?? 0).toFixed(1)} JH)\n`;
          }
        });
      });
      text += `\n`;
    });

    return text;
  }

  copyTextToClipboard(text: string, isGlobal: boolean = false, pmName: string | null = null) {
    navigator.clipboard.writeText(text).then(() => {
      if (isGlobal) {
        this.copiedExportText.set(true);
        setTimeout(() => this.copiedExportText.set(false), 2000);
      } else if (pmName) {
        this.copiedPmCode.set(pmName);
        setTimeout(() => this.copiedPmCode.set(null), 2000);
      }
    }).catch(err => {
      console.error('Erreur lors de la copie du rapport: ', err);
    });
  }

  exportAnomaliesToExcel() {
    const groups = this.anomaliesByPm();
    const rows: Record<string, string | number | null>[] = [];

    groups.forEach(g => {
      g.projects.forEach(proj => {
        proj.services.forEach(srv => {
          let diag = '';
          let gap = 0;
          if (srv.hasConsumedAnomaly) {
            diag = 'Dépassement';
            gap = srv.consumedGap;
          } else if (srv.hasRevisionAnomaly) {
            diag = srv.revisionGap > 0 ? 'Écart hausse' : 'Écart baisse';
            gap = srv.revisionGap;
          } else {
            diag = 'Conforme';
          }

          rows.push({
            'Chef de projet': g.pm,
            'Code Projet': proj.project_code,
            'Nom Projet': proj.project_name || '',
            'Réf JIRA': (proj.jira_references || []).join(', '),
            'Service': srv.service_name,
            'Initial (JH)': srv.initial_jh,
            'Révisé (JH)': srv.revised_jh,
            'Prévisionnel (JH)': srv.previsionnel_jh,
            'Consommé (JH)': srv.consomme_jh,
            'Diagnostic': diag,
            'Écart (JH)': gap,
          });
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Anomalies Triskell');

    ws['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 35 },
      { wch: 20 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
    ];

    const fileName = `Export_Anomalies_Triskell_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  exportAnomaliesToCSV() {
    const groups = this.anomaliesByPm();
    let csvContent = '\uFEFF';
    csvContent += 'Chef de projet;Code Projet;Nom Projet;Réf JIRA;Service;Initial (JH);Révisé (JH);Prévisionnel (JH);Consommé (JH);Diagnostic;Écart (JH)\n';

    groups.forEach(g => {
      g.projects.forEach(proj => {
        proj.services.forEach(srv => {
          let diag = '';
          let gap = 0;
          if (srv.hasConsumedAnomaly) {
            diag = 'Dépassement';
            gap = srv.consumedGap;
          } else if (srv.hasRevisionAnomaly) {
            diag = srv.revisionGap > 0 ? 'Écart hausse' : 'Écart baisse';
            gap = srv.revisionGap;
          } else {
            diag = 'Conforme';
          }

          const pm = (g.pm || '').replace(/"/g, '""');
          const code = (proj.project_code || '').replace(/"/g, '""');
          const name = (proj.project_name || '').replace(/"/g, '""');
          const jira = ((proj.jira_references || []).join(', ')).replace(/"/g, '""');
          const srvName = (srv.service_name || '').replace(/"/g, '""');

          const initial = srv.initial_jh !== null ? String(srv.initial_jh).replace('.', ',') : '';
          const revised = srv.revised_jh !== null ? String(srv.revised_jh).replace('.', ',') : '';
          const prev = srv.previsionnel_jh !== null ? String(srv.previsionnel_jh).replace('.', ',') : '';
          const cons = srv.consomme_jh !== null ? String(srv.consomme_jh).replace('.', ',') : '';
          const gapStr = String(gap).replace('.', ',');

          csvContent += `"${pm}";"${code}";"${name}";"${jira}";"${srvName}";"${initial}";"${revised}";"${prev}";"${cons}";"${diag}";"${gapStr}"\n`;
        });
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Export_Anomalies_Triskell_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
