import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chiffre, ChiffresFormData } from '../../models/chiffres.type';
import { ChiffresService } from '../../services/chiffres.service';
import { Service } from '../../models/types';
import { ResourceService } from '../../services/resource.service';
import { LucideAngularModule, LucideCalculator, LucideHelpCircle } from 'lucide-angular';

@Component({
  selector: 'app-chiffres-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './chiffres-modal.component.html',
  styleUrl: './chiffres-modal.component.css',
})
export class ChiffresModalComponent implements OnInit, OnChanges {
  @Input() visible: boolean = false;
  @Input() idProjet: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Chiffre[]>();

  LucideCalculator = LucideCalculator; // Expose l'icône au template
  LucideHelpCircle = LucideHelpCircle;

  services: Service[] = [];
  chiffres: Map<string, ChiffresFormData> = new Map();
  rafDate: string = new Date().toISOString().split('T')[0];
  isLoading: boolean = false;
  showHelp: boolean = false;
  error: string = '';

  constructor(
    private chiffresService: ChiffresService,
    private resourceService: ResourceService,
  ) {}

  ngOnInit() {
    this.loadServices();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && changes['visible'].currentValue && this.idProjet) {
      console.log('Loading chiffres for project:', this.idProjet);
      this.loadChiffres();
    }
  }

  async loadServices() {
    try {
      this.services = await this.resourceService.getAllServices();
    } catch (err) {
      console.error('Error loading services:', err);
      this.error = 'Erreur lors du chargement des services';
    }
  }

  async loadChiffres() {
    if (!this.idProjet) return;

    try {
      this.isLoading = true;
      const chiffresData = await this.chiffresService.getChiffresByProject(this.idProjet);

      // Initialize form data for each service
      this.chiffres.clear();

      // Create entries for all services
      for (const service of this.services) {
        if (!service.id) continue;
        const chiffre = chiffresData.find((c) => c.id_service === service.id);
        const formData: ChiffresFormData = {
          id_chiffres: chiffre?.id_chiffres,
          id_service: service.id,
          initial: chiffre?.initial || undefined,
          revise: chiffre?.revise || undefined,
          previsionnel: chiffre?.previsionnel || undefined,
          consomme: chiffre?.consomme || undefined,
        };

        this.updateCalculatedFields(formData);

        this.chiffres.set(service.id, formData);
      }

      // Update RAF for all services after loading
      for (const idService of this.chiffres.keys()) {
        this.updateRAF(idService);
      }

      this.isLoading = false;
    } catch (err) {
      this.error = 'Erreur lors du chargement des chiffres';
      this.isLoading = false;
      console.error(err);
    }
  }

  getChiffresData(idService: string): ChiffresFormData {
    const data = this.chiffres.get(idService);

    if (data) {
      return data;
    }

    // Retourner une structure par défaut avec des 0
    return {
      id_service: idService,
      initial: 0,
      revise: 0,
      previsionnel: 0,
      consomme: 0,
      delta: 0,
      restant: 0,
      raf: 0,
      raf_date: new Date().toISOString().split('T')[0],
    };
  }

  getServiceName(idService: string): string {
    return this.services.find((s) => s.id === idService)?.nom || `Service ${idService}`;
  }

  calculateTotal(field: keyof ChiffresFormData): string {
    let total = 0;
    for (const formData of this.chiffres.values()) {
      const value = formData[field];
      if (typeof value === 'number') {
        total += value;
      }
    }
    return total.toFixed(3);
  }

  updateCalculatedFields(formData: ChiffresFormData) {
    // Delta = previsionnel - revise
    if (formData.previsionnel !== undefined && formData.revise !== undefined) {
      formData.delta = formData.previsionnel - formData.revise;
    }

    // Restant = previsionnel - consomme
    if (formData.previsionnel !== undefined && formData.consomme !== undefined) {
      formData.restant = formData.previsionnel - formData.consomme;
    }
  }

  async updateRAF(idService: string) {
    if (!this.idProjet) return;

    try {
      const raf = await this.chiffresService.getRAFByDate(this.idProjet, idService, this.rafDate + 'T00:00:00');

      const formData = this.chiffres.get(idService);
      if (formData) {
        formData.raf = raf;
        formData.raf_date = this.rafDate;
      }
    } catch (err) {
      console.error('Error calculating RAF:', err);
    }
  }

  onValueChange(idService: string, field: string) {
    const formData = this.chiffres.get(idService);
    if (formData) {
      this.updateCalculatedFields(formData);
    }
  }

  onRAFDateChange() {
    // Update RAF for all services with the new date
    for (const idService of this.chiffres.keys()) {
      this.updateRAF(idService);
    }
  }

  async handlePaste(event: ClipboardEvent, serviceId: string, fieldName?: string) {
    event.preventDefault();

    const pastedText = event.clipboardData?.getData('text') || '';
    const lines = pastedText.trim().split('\n');

    // Les champs disponibles dans l'ordre
    const allFields = ['initial', 'revise', 'previsionnel', 'consomme'];

    console.log('fieldName', fieldName);
    // Trouvez l'index du champ où commence le paste
    const startFieldIndex = fieldName ? allFields.indexOf(fieldName) : 0;

    console.log('startFieldIndex', startFieldIndex);
    if (startFieldIndex === -1) return;

    // Si c'est une seule ligne avec plusieurs colonnes (tabulation)
    if (lines.length === 1) {
      const values = lines[0].split('\t').map((v) => v.trim());
      this.fillRowWithValues(serviceId, values, startFieldIndex);
    }

    // Si c'est plusieurs lignes
    else if (lines.length > 1) {
      //indice de début de collage
      let currentServiceIndex = this.services.findIndex((s) => s.id === serviceId);

      lines.forEach((line, lineIndex) => {
        const values = line.split('\t').map((v) => v.trim());

        if (currentServiceIndex + lineIndex < this.services.length) {
          const id = this.services[currentServiceIndex + lineIndex].id || '';

          // Pour la première ligne, on démarre au champ cliqué
          // Pour les lignes suivantes, on redémarre toujours depuis 'initial'
          // non finalement je veux commencer au même index pour chaque ligne : on démarre au champ cliqué
          const fieldIndex = startFieldIndex;
          this.fillRowWithValues(id, values, fieldIndex);
        }
      });
    }
  }

  private fillRowWithValues(serviceId: string, values: string[], startFieldIndex: number) {
    const chiffres = this.getChiffresData(serviceId);
    if (!chiffres) return;

    const allFields: (keyof ChiffresFormData)[] = ['initial', 'revise', 'previsionnel', 'consomme'];

    values.forEach((value, index) => {
      const fieldIndex = startFieldIndex + index;
      // Ne remplissez que les champs valides
      if (fieldIndex < allFields.length && value) {
        const fieldName = allFields[fieldIndex];
        const numValue = parseFloat(value.replace(',', '.'));

        if (!isNaN(numValue)) {
          const field = allFields[fieldIndex];
          if (field === 'initial' || field === 'revise' || field === 'previsionnel' || field === 'consomme') {
            chiffres[field] = numValue;
          }
        }
      }
    });

    // Déclenchez les calculs
    this.onValueChange(serviceId, allFields[startFieldIndex]);
  }

  private parseNumber(value: string): number {
    const parsed = parseFloat(value.trim().replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }

  async save() {
    if (!this.idProjet) return;

    try {
      this.isLoading = true;
      const savedChiffres: Chiffre[] = [];

      for (const [idService, formData] of this.chiffres.entries()) {
        const chiffre: Chiffre = {
          id_projet: this.idProjet,
          id_service: idService,
          initial: formData.initial || 0,
          revise: formData.revise || 0,
          previsionnel: formData.previsionnel || 0,
          consomme: formData.consomme || 0,
        };

        if (formData.id_chiffres) {
          // Update existing
          const updated = await this.chiffresService.updateChiffre(formData.id_chiffres, chiffre);
          savedChiffres.push(updated);
        } else if (formData.initial || formData.revise || formData.previsionnel || formData.consomme) {
          // Create new only if there's data
          const created = await this.chiffresService.createChiffre(chiffre);
          savedChiffres.push(created);
        }
      }

      this.isLoading = false;
      this.saved.emit(savedChiffres);
      this.onClose();
    } catch (err) {
      this.error = 'Erreur lors de la sauvegarde des chiffres';
      this.isLoading = false;
      console.error(err);
    }
  }

  onClose() {
    this.error = '';
    this.close.emit();
  }
}
