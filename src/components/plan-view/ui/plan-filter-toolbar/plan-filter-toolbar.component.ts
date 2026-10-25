import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Filter,
  Search,
  X,
  Trash2,
} from 'lucide-angular';
import { Equipe, Projet, Role, Personne } from '../../../../models/types';
import { SizeFilterCriterion, SizeFilterOperator } from '../../plan-view.models';
import { YearKey } from '../../../../utils/year-selection';

@Component({
  selector: 'app-plan-filter-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
  ],
  templateUrl: './plan-filter-toolbar.component.html',
  styleUrl: './plan-filter-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanFilterToolbarComponent {
  // Inputs d'affichage
  readonly showGlobalFilters = input<boolean>(false);
  readonly activeFiltersCount = input<number>(0);
  readonly activeFiltersSummary = input<string>('');
  readonly globalSearch = input<string>('');

  // Données de base
  readonly allEquipes = input<Equipe[]>([]);
  readonly allProjects = input<Projet[]>([]);
  readonly availableRoles = input<Role[]>([]);
  readonly availablePersonnes = input<Personne[]>([]);
  readonly selectableYears = input<readonly YearKey[]>([]);
  readonly projectStatuses = input<readonly string[]>([]);

  // Filtre Équipes
  readonly filterEquipeIds = input<string[]>([]);
  readonly openEquipeDropdown = input<boolean>(false);

  // Filtre Projets
  readonly filterProjetIds = input<string[]>([]);
  readonly openProjetDropdown = input<boolean>(false);
  readonly filterProjetSearch = input<string>('');
  readonly filteredProjectsForDropdown = input<Projet[]>([]);

  // Filtre Statuts
  readonly filterStatusIds = input<string[]>([]);
  readonly openStatusDropdown = input<boolean>(false);

  // Filtre Ressources
  readonly filterResourceIds = input<string[]>([]);
  readonly openResourceDropdown = input<boolean>(false);

  // Filtre Période
  readonly filterPeriodEnabled = input<boolean>(false);
  readonly periodLabel = input<string>('');
  readonly showPeriodDropdown = input<boolean>(false);
  readonly activePeriodPreset = input<number | null>(null);
  readonly effectivePeriodStart = input<string>('');
  readonly effectivePeriodEnd = input<string>('');

  // Filtre Taille
  readonly filterSizeEnabled = input<boolean>(false);
  readonly sizeFilterLabel = input<string>('');
  readonly openSizeDropdown = input<boolean>(false);
  readonly filterSizeCriterion = input<SizeFilterCriterion>('charges_all');
  readonly filterSizeOperator = input<SizeFilterOperator>('gte');
  readonly filterSizeValue = input<number | null>(null);

  // Semaines filtrées
  readonly filteredWeekCount = input<number>(0);

  // Outputs vers le parent
  readonly toggleGlobalFilters = output<void>();
  readonly clearAllFilters = output<void>();
  readonly searchChange = output<string>();

  readonly dropdownToggle = output<{ name: 'equipe' | 'projet' | 'statut' | 'resource' | 'size'; event: MouseEvent }>();
  readonly periodDropdownToggle = output<Event>();

  readonly equipeToggle = output<{ id: string; event: Event }>();
  readonly equipeClear = output<void>();

  readonly projetToggle = output<{ id: string; event: Event }>();
  readonly projetSearchChange = output<string>();
  readonly selectAllProjects = output<void>();
  readonly deselectAllProjects = output<void>();

  readonly statusToggle = output<{ status: string; event: Event }>();
  readonly statusClear = output<void>();

  readonly resourceToggle = output<{ key: string; event: Event }>();
  readonly resourceClear = output<void>();

  readonly periodToggle = output<boolean>();
  readonly periodPresetChange = output<number>();
  readonly periodStartChange = output<string>();
  readonly periodEndChange = output<string>();

  readonly sizeFilterToggle = output<boolean>();
  readonly sizeCriterionChange = output<SizeFilterCriterion>();
  readonly sizeOperatorChange = output<SizeFilterOperator>();
  readonly sizeValueChange = output<number | null>();

  readonly clearAllWeekFilters = output<void>();

  // Icônes
  readonly Filter = Filter;
  readonly Search = Search;
  readonly X = X;
  readonly Trash2 = Trash2;

  getEquipeName(id: string): string {
    return this.allEquipes().find((x) => x.id === id)?.nom || '—';
  }

  getProjetLabel(id: string): string {
    const p = this.allProjects().find((x) => x.id === id);
    return p ? `${p.code_projet} — ${p.nom_projet}` : '—';
  }

  getResourceLabel(sel: string): string {
    const [type, id] = sel.split(':');
    if (type === 'role') {
      const r = this.availableRoles().find((x) => x.id === id);
      return r ? `Role: ${r.nom}` : 'Role: —';
    }
    const p = this.availablePersonnes().find((x) => x.id === id);
    return p ? `${p.prenom} ${p.nom}` : 'Pers: —';
  }
}
