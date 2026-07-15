import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private static instance: ToastService | null = null;

  constructor() {
    ToastService.instance = this;
  }

  public static getInstance(): ToastService | null {
    return ToastService.instance;
  }

  private _toasts = signal<Toast[]>([]);
  public toasts = this._toasts.asReadonly();

  show(type: Toast['type'], message: string, duration = 5000) {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const toast: Toast = { id, type, message, duration };
    this._toasts.update((current) => [...current, toast]);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
  }

  success(message: string, duration = 5000) {
    this.show('success', message, duration);
  }

  error(message: string, duration = 5000) {
    this.show('error', message, duration);
  }

  warning(message: string, duration = 8000) {
    this.show('warning', message, duration);
  }

  info(message: string, duration = 5000) {
    this.show('info', message, duration);
  }

  dismiss(id: string) {
    this._toasts.update((current) => current.filter((t) => t.id !== id));
  }
}
