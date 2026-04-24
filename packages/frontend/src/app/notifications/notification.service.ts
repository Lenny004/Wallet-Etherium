import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertOptions, SweetAlertResult } from 'sweetalert2';

const palette = {
  background: '#171f33',
  color: '#dae2fd',
  confirm: '#00e5ff',
  deny: '#bac9cc',
  cancel: '#2d3449',
} as const;

const modalDefaults: SweetAlertOptions = {
  background: palette.background,
  color: palette.color,
  confirmButtonColor: palette.confirm,
  confirmButtonText: 'Aceptar',
  cancelButtonColor: palette.cancel,
  denyButtonColor: palette.deny,
  customClass: {
    popup: 'app-swal-popup',
    title: 'app-swal-title',
    htmlContainer: 'app-swal-body',
    confirmButton: 'app-swal-confirm',
    cancelButton: 'app-swal-cancel',
  },
};

/**
 * Notificaciones con SweetAlert2: toasts discretos y modales cuando hace falta confirmación.
 * (shadcn/ui es principalmente para React; en Angular este enfoque es el habitual.)
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly toast = Swal.mixin({
    toast: true,
    position: 'bottom-end',
    showConfirmButton: false,
    timer: 4200,
    timerProgressBar: true,
    background: palette.background,
    color: palette.color,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  toastSuccess(message: string): void {
    void this.toast.fire({ icon: 'success', title: message });
  }

  toastError(message: string): void {
    void this.toast.fire({ icon: 'error', title: message });
  }

  toastWarning(message: string): void {
    void this.toast.fire({ icon: 'warning', title: message });
  }

  toastInfo(message: string): void {
    void this.toast.fire({ icon: 'info', title: message });
  }

  alertSuccess(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      ...modalDefaults,
      icon: 'success',
      title,
      text,
    });
  }

  alertError(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      ...modalDefaults,
      icon: 'error',
      title,
      text,
    });
  }

  alertWarning(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      ...modalDefaults,
      icon: 'warning',
      title,
      text,
    });
  }

  alertInfo(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      ...modalDefaults,
      icon: 'info',
      title,
      text,
    });
  }

  /**
   * Modal sí/no. Devuelve true si el usuario confirma.
   */
  confirm(options: {
    title: string;
    text?: string;
    confirmText?: string;
    cancelText?: string;
    icon?: SweetAlertIcon;
  }): Promise<boolean> {
    return Swal.fire({
      ...modalDefaults,
      icon: options.icon ?? 'question',
      title: options.title,
      text: options.text,
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? 'Confirmar',
      cancelButtonText: options.cancelText ?? 'Cancelar',
    }).then((r) => r.isConfirmed);
  }
}
