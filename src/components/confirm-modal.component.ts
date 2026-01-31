import { Component, EventEmitter, Input, Output, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, AlertTriangle, X } from 'lucide-angular';

@NgModule({
  imports: [LucideAngularModule.pick({ AlertTriangle, X })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, LucideIconsModule],
  template: `
    <div *ngIf="visible" class="confirm-overlay" (click)="onCancel()">
      <div class="confirm-card" (click)="$event.stopPropagation()">
        <div class="confirm-header">
          <div class="header-left">
            <div class="icon-container">
              <lucide-icon [name]="icon" [size]="24" class="confirm-icon"></lucide-icon>
            </div>
            <h3 class="confirm-title">{{ title }}</h3>
          </div>
          <button class="close-btn" (click)="onCancel()">
            <lucide-icon name="x" [size]="20"></lucide-icon>
          </button>
        </div>
        
        <div class="confirm-body">
          <p class="confirm-message">{{ message }}</p>
        </div>
        
        <div class="confirm-footer">
          <button class="btn btn-secondary" (click)="onCancel()">{{ cancelLabel }}</button>
          <button class="btn btn-danger" (click)="onConfirm()">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.2s ease-out;
    }

    .confirm-card {
      background: white;
      width: 100%;
      max-width: 420px;
      border-radius: 20px;
      box-shadow: 
        0 20px 25px -5px rgba(0, 0, 0, 0.1), 
        0 10px 10px -5px rgba(0, 0, 0, 0.04),
        0 0 0 1px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      transform: scale(1);
      animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.9) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .confirm-header {
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .icon-container {
      width: 48px;
      height: 48px;
      background: #fee2e2;
      color: #ef4444;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .confirm-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .close-btn {
      background: #f1f5f9;
      border: none;
      color: #64748b;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .close-btn:hover {
      background: #e2e8f0;
      color: #1e293b;
    }

    .confirm-body {
      padding: 0 24px 32px 24px;
    }

    .confirm-message {
      font-size: 15px;
      color: #7d8a9e;
      line-height: 1.5;
      margin: 0;
      white-space: pre-wrap;
    }

    .confirm-footer {
      padding: 16px 24px 20px;
      background: #f8fafc;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      border-top: 1px solid #f1f5f9;
    }

    .btn {
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-secondary {
      background: white;
      color: #475569;
      border: 1px solid #e2e8f0;
    }

    .btn-secondary:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
      box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);
    }

    .btn-danger:hover {
      background: #dc2626;
      box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.3);
      transform: translateY(-1px);
    }

    .btn-danger:active {
      transform: translateY(0);
    }
  `]
})
export class ConfirmModalComponent {
  @Input() visible = false;
  @Input() title = 'Confirmation';
  @Input() message = 'Êtes-vous sûr de vouloir effectuer cette action ?';
  @Input() icon = 'alert-triangle';
  @Input() confirmLabel = 'Confirmer';
  @Input() cancelLabel = 'Annuler';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm() {
    this.confirm.emit();
  }

  onCancel() {
    this.cancel.emit();
  }
}
