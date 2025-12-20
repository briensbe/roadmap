import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chiffre, ChiffresFormData } from '../models/chiffres.type';
import { ChiffresService } from '../services/chiffres.service';
import { Service } from '../models/types';
import { ResourceService } from '../services/resource.service';

@Component({
  selector: 'app-chiffres-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chiffres-modal.component.html',
  styleUrl: './chiffres-modal.component.css'
})
export class ChiffresModalComponent implements OnInit, OnChanges {
  @Input() visible: boolean = false;
  @Input() idProjet: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Chiffre[]>();

  services: Service[] = [];
  chiffres: Map<number, ChiffresFormData> = new Map();
  rafDate: string = new Date().toISOString().split('T')[0];
  isLoading: boolean = false;
  error: string = '';

  constructor(
    private chiffresService: ChiffresService,
    private resourceService: ResourceService
  ) {}

  ngOnInit() {
    this.loadServices();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && changes['visible'].currentValue && this.idProjet) {
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
        const chiffre = chiffresData.find(c => c.id_service === parseInt(service.id || '0'));
        const formData: ChiffresFormData = {
          id_chiffres: chiffre?.id_chiffres,
          initial: chiffre?.initial || undefined,
          revise: chiffre?.revise || undefined,
          previsionnel: chiffre?.previsionnel || undefined,
          consomme: chiffre?.consomme || undefined,
          date_mise_a_jour: chiffre?.date_mise_a_jour ? chiffre.date_mise_a_jour.split('T')[0] : new Date().toISOString().split('T')[0]
        };
        
        this.updateCalculatedFields(formData);
        this.chiffres.set(parseInt(service.id || '0'), formData);
      }
      
      this.isLoading = false;
    } catch (err) {
      this.error = 'Erreur lors du chargement des chiffres';
      this.isLoading = false;
      console.error(err);
    }
  }

  getServiceName(idService: number): string {
    return this.services.find(s => s.id === idService.toString())?.nom || `Service ${idService}`;
  }

  getNumericId(service: Service): number {
    return parseInt(service.id || '0', 10);
  }

  calculateTotal(field: 'initial' | 'revise' | 'previsionnel' | 'consomme' | 'delta' | 'restant' | 'raf'): string {
    let total = 0;
    for (const formData of this.chiffres.values()) {
      const value = formData[field];
      if (value !== undefined && value !== null) {
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

  async updateRAF(idService: number) {
    if (!this.idProjet) return;
    
    try {
      const raf = await this.chiffresService.getRAFByDate(
        this.idProjet,
        idService,
        this.rafDate + 'T00:00:00'
      );
      
      const formData = this.chiffres.get(idService);
      if (formData) {
        formData.raf = raf;
        formData.raf_date = this.rafDate;
      }
    } catch (err) {
      console.error('Error calculating RAF:', err);
    }
  }

  onValueChange(idService: number, field: string) {
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

  async handlePaste(event: ClipboardEvent, startingIdService: number) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    const lines = text.split('\n').filter(line => line.trim());
    
    let serviceIndex = this.services.findIndex(s => s.id === startingIdService.toString());
    if (serviceIndex === -1) return;

    for (const line of lines) {
      const values = line.split('\t');
      if (serviceIndex >= this.services.length) break;

      const service = this.services[serviceIndex];
      const idService = parseInt(service.id || '0');
      const formData = this.chiffres.get(idService);

      if (formData) {
        // Assuming order: initial, revise, previsionnel, consomme
        if (values[0]) formData.initial = this.parseNumber(values[0]);
        if (values[1]) formData.revise = this.parseNumber(values[1]);
        if (values[2]) formData.previsionnel = this.parseNumber(values[2]);
        if (values[3]) formData.consomme = this.parseNumber(values[3]);
        
        this.updateCalculatedFields(formData);
      }
      
      serviceIndex++;
    }
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
          date_mise_a_jour: formData.date_mise_a_jour
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
