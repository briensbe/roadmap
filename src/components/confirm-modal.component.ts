import { Component, EventEmitter, Input, Output, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, AlertTriangle, X, AlertCircle, FileUp, FileDown } from 'lucide-angular';

@NgModule({
  imports: [LucideAngularModule.pick({ AlertTriangle, X, AlertCircle, FileUp, FileDown })],
  exports: [LucideAngularModule],
})
export class LucideIconsModule {}

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, LucideIconsModule],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.css',
})
export class ConfirmModalComponent {
  @Input() visible = false;
  @Input() title = 'Confirmation';
  @Input() message = 'Êtes-vous sûr de vouloir effectuer cette action ?';
  @Input() warningText = '';
  @Input() icon = 'alert-triangle';
  @Input() confirmLabel = 'Confirmer';
  @Input() cancelLabel = 'Annuler';
  @Input() showCancel = true;
  @Input() variant: 'danger' | 'primary' = 'danger';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm() {
    this.confirm.emit();
  }

  onCancel() {
    this.cancel.emit();
  }
}
