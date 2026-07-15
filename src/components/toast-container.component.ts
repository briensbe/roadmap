import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../services/toast.service';
import { LucideAngularModule, X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-angular';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.css',
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
  
  // Expose icons to template
  protected readonly XIcon = X;
  protected readonly CheckCircleIcon = CheckCircle;
  protected readonly AlertTriangleIcon = AlertTriangle;
  protected readonly AlertCircleIcon = AlertCircle;
  protected readonly InfoIcon = Info;
}
