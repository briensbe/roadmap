import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImportService, ServiceMapping } from '../../services/import/import.service';
import { ServicesService } from '../../services/services.service';
import { ProjetService } from '../../services/projet.service';
import { TriskellImportProcessor, ImportResult } from '../../services/import/TriskellImportProcessor';
import { Service } from '../../models/types';
import { ConfirmModalComponent } from '../confirm-modal.component';
import {
  LucideAngularModule,
  Shield,
  Layers,
  FileSpreadsheet,
  Plus,
  PlusCircle,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  CheckCircle,
  Database,
  Building2,
  Calendar,
  ArrowRight,
  Upload,
  XCircle,
  CheckCircle2,
} from 'lucide-angular';

@Component({
  selector: 'app-administration',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ConfirmModalComponent],
  templateUrl: './administration.component.html',
  styleUrl: './administration.component.css',
})
export class AdministrationComponent implements OnInit {
  private importService = inject(ImportService);
  private servicesService = inject(ServicesService);
  private projetService = inject(ProjetService);

  // Lucide Icons
  Shield = Shield;
  Layers = Layers;
  FileSpreadsheet = FileSpreadsheet;
  Plus = Plus;
  PlusCircle = PlusCircle;
  Trash2 = Trash2;
  Edit2 = Edit2;
  Check = Check;
  X = X;
  RefreshCw = RefreshCw;
  CheckCircle = CheckCircle;
  Database = Database;
  Building2 = Building2;
  Calendar = Calendar;
  ArrowRight = ArrowRight;
  Upload = Upload;
  XCircle = XCircle;
  CheckCircle2 = CheckCircle2;

  // Excel Upload States
  isDragging = signal<boolean>(false);
  isProcessing = signal<boolean>(false);
  excelError = signal<string | null>(null);
  excelSuccessSummary = signal<ImportResult | null>(null);

  // Local Services Cache
  localServices = signal<Service[]>([]);
  isLoadingLocalServices = signal<boolean>(false);

  // Toggle Add Form Visibility
  showAddForm = signal<boolean>(false);

  // Form State - Add Mapping
  newServiceId = signal<string>('');
  newServiceName = signal<string>('');
  formError = signal<string | null>(null);

  // Form State - Edit Mapping
  editingId = signal<number | null>(null);
  editServiceId = signal<string>('');
  editServiceName = signal<string>('');
  editFormError = signal<string | null>(null);

  // Queries & Mutations (Tanstack Query)
  serviceMappingsQuery = this.importService.getServiceMappingsQuery();
  batchesQuery = this.importService.getBatchesQuery();
  triskellServiceNamesQuery = this.importService.getTriskellServiceNamesQuery();

  // Computed list of available (unmapped) Triskell service names
  unmappedTriskellServiceNames = computed(() => {
    const allNames = this.triskellServiceNamesQuery.data() || [];
    const mappings = this.serviceMappingsQuery.data() || [];
    const mappedNames = new Set(mappings.map((m) => m.service_name.toLowerCase()));
    return allNames.filter((name) => !mappedNames.has(name.toLowerCase()));
  });

  // Computed list of available (unmapped) local services
  unmappedLocalServices = computed(() => {
    const allServices = this.localServices() || [];
    const mappings = this.serviceMappingsQuery.data() || [];
    const mappedServiceIds = new Set(mappings.map((m) => m.service_id));
    return allServices.filter((srv) => srv.id && !mappedServiceIds.has(srv.id));
  });

  createMappingMutation = this.importService.createServiceMappingMutation();
  updateMappingMutation = this.importService.updateServiceMappingMutation();
  deleteMappingMutation = this.importService.deleteServiceMappingMutation();
  activateBatchMutation = this.importService.activateBatchMutation();
  deactivateBatchMutation = this.importService.deactivateBatchMutation();
  deleteBatchMutation = this.importService.deleteBatchMutation();

  ngOnInit() {
    this.loadLocalServices();
  }

  async loadLocalServices() {
    this.isLoadingLocalServices.set(true);
    try {
      const data = await this.servicesService.getAllServices();
      this.localServices.set(data || []);
    } catch (err: any) {
      console.error('Failed to load local services:', err);
    } finally {
      this.isLoadingLocalServices.set(false);
    }
  }

  // CRUD Actions
  async handleAddMapping() {
    this.formError.set(null);

    const serviceId = this.newServiceId().trim();
    const serviceName = this.newServiceName().trim();

    if (!serviceId) {
      this.formError.set('Veuillez sélectionner un service local.');
      return;
    }
    if (!serviceName) {
      this.formError.set('Veuillez saisir ou sélectionner un service Triskell.');
      return;
    }

    // Frontend validation to prevent duplicate service_name mapping
    const currentMappings = this.serviceMappingsQuery.data() || [];
    const nameExists = currentMappings.some(
      (m) => m.service_name.toLowerCase() === serviceName.toLowerCase()
    );
    if (nameExists) {
      this.formError.set('Ce nom de service Triskell est déjà associé.');
      return;
    }

    // Frontend validation to prevent duplicate service_id mapping (1-1 check)
    const serviceExists = currentMappings.some(
      (m) => m.service_id === serviceId
    );
    if (serviceExists) {
      this.formError.set('Ce service local est déjà associé à un autre service Triskell.');
      return;
    }

    this.createMappingMutation.mutate(
      { service_id: serviceId, service_name: serviceName },
      {
        onSuccess: () => {
          this.newServiceId.set('');
          this.newServiceName.set('');
        },
        onError: (err: any) => {
          if (err.message && err.message.includes('unique')) {
            this.formError.set('Ce nom de service Triskell est déjà associé.');
          } else {
            this.formError.set(err.message || 'Une erreur est survenue lors de la création.');
          }
        },
      }
    );
  }

  cancelAddMapping() {
    this.newServiceId.set('');
    this.newServiceName.set('');
    this.formError.set(null);
    this.showAddForm.set(false);
  }

  startEdit(mapping: ServiceMapping) {
    this.editingId.set(mapping.id);
    this.editServiceId.set(mapping.service_id);
    this.editServiceName.set(mapping.service_name);
    this.editFormError.set(null);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editServiceId.set('');
    this.editServiceName.set('');
    this.editFormError.set(null);
  }

  async handleUpdateMapping(id: number) {
    this.editFormError.set(null);

    const serviceId = this.editServiceId().trim();
    const serviceName = this.editServiceName().trim();

    if (!serviceId) {
      this.editFormError.set('Veuillez sélectionner un service local.');
      return;
    }
    if (!serviceName) {
      this.editFormError.set('Veuillez saisir un service Triskell.');
      return;
    }

    // Frontend validation to prevent duplicate service_name mapping on update
    const currentMappings = this.serviceMappingsQuery.data() || [];
    const nameExists = currentMappings.some(
      (m) => m.id !== id && m.service_name.toLowerCase() === serviceName.toLowerCase()
    );
    if (nameExists) {
      this.editFormError.set('Ce nom de service Triskell est déjà associé.');
      return;
    }

    // Frontend validation to prevent duplicate service_id mapping on update (1-1 check)
    const serviceExists = currentMappings.some(
      (m) => m.id !== id && m.service_id === serviceId
    );
    if (serviceExists) {
      this.editFormError.set('Ce service local est déjà associé à un autre service Triskell.');
      return;
    }

    this.updateMappingMutation.mutate(
      { id, service_id: serviceId, service_name: serviceName },
      {
        onSuccess: () => {
          this.cancelEdit();
        },
        onError: (err: any) => {
          if (err.message && err.message.includes('unique')) {
            this.editFormError.set('Ce nom de service Triskell est déjà associé.');
          } else {
            this.editFormError.set(err.message || 'Une erreur est survenue.');
          }
        },
      }
    );
  }

  // Delete Mapping Modal Signals & Handlers
  showConfirmDeleteMapping = signal<boolean>(false);
  mappingIdToDelete = signal<number | null>(null);

  handleDeleteMapping(id: number) {
    this.mappingIdToDelete.set(id);
    this.showConfirmDeleteMapping.set(true);
  }

  confirmDeleteMapping() {
    const id = this.mappingIdToDelete();
    if (id !== null) {
      this.deleteMappingMutation.mutate(id, {
        onSuccess: () => {
          this.showConfirmDeleteMapping.set(false);
          this.mappingIdToDelete.set(null);
        },
        onError: (err: any) => {
          alert('Erreur lors de la suppression : ' + (err.message || err));
          this.showConfirmDeleteMapping.set(false);
          this.mappingIdToDelete.set(null);
        },
      });
    }
  }

  // Activate Modal Signals & Handlers
  showConfirmActivate = signal<boolean>(false);
  batchIdToActivate = signal<number | null>(null);

  handleActivateBatch(batchId: number) {
    this.batchIdToActivate.set(batchId);
    this.showConfirmActivate.set(true);
  }

  confirmActivateBatch() {
    const batchId = this.batchIdToActivate();
    if (batchId !== null) {
      this.activateBatchMutation.mutate(batchId, {
        onSuccess: () => {
          this.showConfirmActivate.set(false);
          this.batchIdToActivate.set(null);
        },
        onError: (err: any) => {
          alert('Erreur lors de l\'activation : ' + (err.message || err));
          this.showConfirmActivate.set(false);
          this.batchIdToActivate.set(null);
        },
      });
    }
  }

  // Deactivate Modal Signals & Handlers
  showConfirmDeactivate = signal<boolean>(false);
  batchIdToDeactivate = signal<number | null>(null);

  toggleBatchActive(batch: any, event: Event) {
    event.preventDefault();
    if (batch.is_active) {
      this.batchIdToDeactivate.set(batch.id);
      this.showConfirmDeactivate.set(true);
    } else {
      this.handleActivateBatch(batch.id);
    }
  }

  confirmDeactivateBatch() {
    const batchId = this.batchIdToDeactivate();
    if (batchId !== null) {
      this.deactivateBatchMutation.mutate(batchId, {
        onSuccess: () => {
          this.showConfirmDeactivate.set(false);
          this.batchIdToDeactivate.set(null);
        },
        onError: (err: any) => {
          alert('Erreur lors de la désactivation : ' + (err.message || err));
          this.showConfirmDeactivate.set(false);
          this.batchIdToDeactivate.set(null);
        },
      });
    }
  }

  // Delete Modal Signals & Handlers
  showConfirmDelete = signal<boolean>(false);
  batchIdToDelete = signal<number | null>(null);

  handleDeleteBatch(batchId: number) {
    this.batchIdToDelete.set(batchId);
    this.showConfirmDelete.set(true);
  }

  confirmDeleteBatch() {
    const batchId = this.batchIdToDelete();
    if (batchId !== null) {
      this.deleteBatchMutation.mutate(batchId, {
        onSuccess: () => {
          this.showConfirmDelete.set(false);
          this.batchIdToDelete.set(null);
        },
        onError: (err: any) => {
          alert('Erreur lors de la suppression : ' + (err.message || err));
          this.showConfirmDelete.set(false);
          this.batchIdToDelete.set(null);
        },
      });
    }
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Drag & Drop Handlers
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processExcelFile(files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processExcelFile(input.files[0]);
    }
  }

  private async processExcelFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.excelError.set('Type de fichier invalide. Veuillez déposer un fichier Excel (.xlsx).');
      return;
    }

    this.isProcessing.set(true);
    this.excelError.set(null);
    this.excelSuccessSummary.set(null);

    try {
      const reader = new FileReader();

      // Promisify FileReader load event
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
      });

      // Initialize processor and invoke client-side pipeline
      const processor = new TriskellImportProcessor(this.projetService['supabase'].client);
      const result = await processor.processImportBuffer(arrayBuffer, file.name);

      this.excelSuccessSummary.set(result);

      // Invalidate query caches to trigger UI reload
      const queryClient = this.importService['queryClient'];
      await queryClient.invalidateQueries({ queryKey: ['import-batches'] });
    } catch (err: any) {
      console.error('Error processing Excel import:', err);
      this.excelError.set(err.message || 'Une erreur est survenue lors de la lecture du fichier Excel.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  closeSummary() {
    this.excelSuccessSummary.set(null);
  }

  closeError() {
    this.excelError.set(null);
  }
}
