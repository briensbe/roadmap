/**
 * @file plan-view.models.ts
 * @description Modèles, contrats de données et helpers purs de formatage de la vue Planification.
 *
 * Responsabilités :
 * - Définir les structures de l'arbre de planification (`ParentRow`, `ChildRow`, `ResourceRow`).
 * - Définir les contrats d'entrée/sortie entre les modules (`PlanRawDataset`, `PlanFilterCriteria`, `SelectedCell`).
 * - Centraliser l'enregistrement des icônes Lucide (`PLAN_VIEW_ICONS`, `LucideIconsModule`).
 * - Fournir les fonctions pures de formatage et de résumé des filtres (période, taille, compteur de filtres actifs).
 */
import { NgModule } from '@angular/core';
import {
  LucideAngularModule,
  Plus,
  ChevronDown,
  ChevronRight,
  User,
  Contact,
  X,
  SquarePlus,
  SquareMinus,
  ExternalLink,
  FunnelPlus,
  FunnelX,
  FileDown,
  LucideCalculator,
  Search,
  MoreVertical,
  ListTree,
  AlignJustify,
  Eye,
  EyeOff,
  Calendar,
  ChevronLeft,
  Network,
  Users,
  BookUser,
  Settings2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Play,
  AlertTriangle,
  Filter,
  Info,
  Trash2,
  Copy,
  Check,
  Layers,
  Building2,
  LoaderCircle,
} from 'lucide-angular';
import { Equipe, Projet, Charge, Role, Personne, Capacite, Jalon, Service } from '../../models/types';
import { Chiffre } from '../../models/chiffres.type';

export type PlanViewMode = 'project' | 'team' | 'resource' | 'service';
export type ZoomLevel = 'compact' | 'normal';
export type PlanningMode = 'saisie' | 'visualisation';
export type ChiffreCategory = 'initial' | 'revise' | 'previsionnel' | 'consomme' | 'restant';
export type CapacityYearSelection = 'today' | 'all' | '2025' | '2026' | 'custom';
export type PlannedDaysPeriod = 'today' | 'all' | '2025' | '2026';
export type SizeFilterOperator = 'gte' | 'lte';
export type SizeFilterCriterion =
  | 'charges_today'
  | 'charges_all'
  | 'charges_2025'
  | 'charges_2026'
  | 'chiffre_initial'
  | 'chiffre_revise'
  | 'chiffre_previsionnel'
  | 'chiffre_consomme'
  | 'chiffre_restant';

export interface ResourceCellData {
  value: number;
  availability: number;
  showAvailability: boolean;
  isPositive: boolean;
  isZero: boolean;
  isNegative: boolean;
  hasCapRecord: boolean;
  comment?: string | null;
}

export interface ResourceRow {
  id: string;
  uniqueId: string;
  label: string;
  type: 'role' | 'personne';
  jours_par_semaine: number;
  charges: Map<string, number>;
  dailyCharges?: Map<string, number>;
  comments?: Map<string, string>;
  color?: string;
  resourceId?: string;
  projectId?: string;
  equipeId?: string;
  code?: string;
  reference_externe?: string;
  cellData?: ResourceCellData[];
  metrics?: Map<string, { total: number }>;
}

export interface ChildRow {
  id: string;
  label: string;
  code?: string;
  reference_externe?: string;
  color?: string;
  expanded: boolean;
  resources: ResourceRow[];
  charges: Map<string, number>;
  dailyCharges?: Map<string, number>;
  originalProject?: Projet;
  metrics?: Map<string, { total: number }>;
  summaryResource?: ResourceRow;
}

export interface ParentMetricItem {
  total: number;
  capacity: number;
  availability: number;
  status: 'positive' | 'zero' | 'negative' | 'none';
}

export interface ParentRow {
  id: string;
  label: string;
  code?: string;
  reference_externe?: string;
  color?: string;
  expanded: boolean;
  children: ChildRow[];
  totalCharges: Map<string, number>;
  originalProject?: Projet;
  metrics?: Map<string, ParentMetricItem>;
  summaryResource?: ResourceRow;
}

export interface DisplayedMonth {
  key: string;
  label: string;
  year: number;
  quarterLabel: string;
  startWeekNum: number;
  weeks: Date[];
}

export interface DisplayedQuarter {
  label: string;
  year: number;
  weeksCount: number;
  months: DisplayedMonth[];
}

export interface DisplayedYear {
  year: number;
  weeksCount: number;
}

export interface GanttBarRange {
  left: number;
  width: number;
}

export interface SelectedCell {
  resource: ResourceRow;
  week: Date;
  childId: string;
  parentId: string;
}

export interface ProjectionCommittingState {
  resourceUniqueId: string;
  startWeekIdx: number;
  nbWeeks: number;
}

export interface ChiffrePopoverData {
  teamId: string;
  projectId: string;
  resourceId?: string;
  resourceType?: 'role' | 'personne';
}

export interface LinkableItem {
  id: string;
  label: string;
  type?: 'role' | 'personne';
}

export interface ResourceTarget {
  projetId: string;
  equipeId: string;
  roleId?: string;
  personneId?: string;
}

export interface RoleAttachmentRecord {
  id?: string;
  role_id: string;
  equipe_id?: string | null;
  departement_id?: string | null;
  service_id?: string | null;
}

export interface PlanRawDataset {
  allEquipes: Equipe[];
  allCharges: Charge[];
  allProjects: Projet[];
  availableRoles: Role[];
  availablePersonnes: Personne[];
  allJalons: Jalon[];
  allLinks: { equipe_id: string; projet_id: string }[];
  allRoleAttachments: RoleAttachmentRecord[];
  allCapacities: Capacite[];
  allChiffres: Chiffre[];
  allServices: Service[];
  capacityIndex: Map<string, number>;
  usageMap: Map<string, number>;
}

export interface PlanFilterCriteria {
  viewMode: PlanViewMode;
  globalSearch: string;
  filterEquipeIds: string[];
  filterProjetIds: string[];
  filterResourceIds: string[];
  filterStatusIds: string[];
  filterPeriodEnabled: boolean;
  effectivePeriodStart: string;
  effectivePeriodEnd: string;
  filterSizeEnabled: boolean;
  filterSizeCriterion: SizeFilterCriterion;
  filterSizeOperator: SizeFilterOperator;
  filterSizeValue: number | null;
  weekFilters: number[];
  chiffreMode: ChiffreCategory;
}

export const PLAN_VIEW_ICONS = {
  Plus,
  ChevronDown,
  ChevronRight,
  User,
  Contact,
  X,
  SquarePlus,
  SquareMinus,
  ExternalLink,
  FunnelPlus,
  FunnelX,
  FileDown,
  LucideCalculator,
  Search,
  MoreVertical,
  ListTree,
  AlignJustify,
  Eye,
  EyeOff,
  Calendar,
  ChevronLeft,
  Network,
  Users,
  BookUser,
  Settings2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Play,
  AlertTriangle,
  Filter,
  Info,
  Trash2,
  Copy,
  Check,
  Layers,
  Building2,
  LoaderCircle,
};

@NgModule({
  imports: [LucideAngularModule.pick(PLAN_VIEW_ICONS)],
  exports: [LucideAngularModule],
})
export class LucideIconsModule {}

export {
  type Equipe,
  type Projet,
  type Charge,
  type Role,
  type Personne,
  type Capacite,
  type Jalon,
  type Service,
  PROJECT_STATUS_LIST,
  type LoadDataOptions,
} from '../../models/types';
export type { Chiffre } from '../../models/chiffres.type';

export const SIZE_FILTER_LABELS: Record<SizeFilterCriterion, string> = {
  charges_today: 'Charges RAF',
  charges_all: 'Charges Tout',
  charges_2025: 'Charges 2025',
  charges_2026: 'Charges 2026',
  chiffre_initial: 'Chiffre Init.',
  chiffre_revise: 'Chiffre Rév.',
  chiffre_previsionnel: 'Chiffre Prév.',
  chiffre_consomme: 'Chiffre Conso.',
  chiffre_restant: 'Chiffre Rest.',
};

export function getDefaultPeriodStart(): string {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return monday.toISOString().split('T')[0];
}

export function getDefaultPeriodEnd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().split('T')[0];
}

export function computeActivePeriodPreset(start: string, end: string): number | null {
  for (const months of [3, 6, 12]) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    if (d.toISOString().split('T')[0] === end) return months;
  }
  return null;
}

export function formatPeriodFilterLabel(enabled: boolean, start: string, end: string): string {
  if (!enabled) return 'Désactivé';
  const fmt = (s: string) => {
    const [y, m, day] = s.split('-');
    return `${day}/${m}/${y.slice(2)}`;
  };
  return `${fmt(start)} → ${fmt(end)}`;
}

export function formatSizeFilterLabel(
  enabled: boolean,
  criterion: SizeFilterCriterion,
  operator: SizeFilterOperator,
  value: number | null,
): string {
  if (!enabled || value === null) return 'Désactivé';
  const opLabel = operator === 'gte' ? '≥' : '≤';
  return `${SIZE_FILTER_LABELS[criterion]} ${opLabel} ${value} j`;
}

export function computeActiveFiltersCount(params: {
  search: string;
  eqLen: number;
  prLen: number;
  stLen: number;
  resLen: number;
  periodEnabled: boolean;
  sizeActive: boolean;
  wkLen: number;
}): number {
  let count = params.eqLen + params.prLen + params.stLen + params.resLen + params.wkLen;
  if (params.search.trim()) count++;
  if (params.periodEnabled) count++;
  if (params.sizeActive) count++;
  return count;
}

export function computeActiveFiltersSummary(params: {
  search: string;
  eqLen: number;
  prLen: number;
  stLen: number;
  resLen: number;
  periodEnabled: boolean;
  sizeActive: boolean;
  wkLen: number;
}): string {
  const parts: string[] = [];
  if (params.search.trim()) parts.push('Recherche');
  if (params.eqLen > 0) parts.push(`${params.eqLen} équipe${params.eqLen > 1 ? 's' : ''}`);
  if (params.prLen > 0) parts.push(`${params.prLen} projet${params.prLen > 1 ? 's' : ''}`);
  if (params.stLen > 0) parts.push(`${params.stLen} statut${params.stLen > 1 ? 's' : ''}`);
  if (params.resLen > 0) parts.push(`${params.resLen} ressource${params.resLen > 1 ? 's' : ''}`);
  if (params.periodEnabled) parts.push('Période');
  if (params.sizeActive) parts.push('Taille');
  if (params.wkLen > 0) parts.push(`${params.wkLen} semaine${params.wkLen > 1 ? 's' : ''}`);
  return parts.join(', ');
}
