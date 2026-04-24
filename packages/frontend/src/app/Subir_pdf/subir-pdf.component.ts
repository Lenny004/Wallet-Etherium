import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { EventSocketService } from '../blockchain/event-socket.service';

interface TokenizedImageResponse {
  tokenId: string;
  fileName: string;
  mimeType: string;
  status: string;
  txHash?: string;
}

@Component({
  selector: 'app-subir-pdf',
  imports: [FormsModule],
  templateUrl: './subir-pdf.component.html',
  styleUrl: './subir-pdf.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubirPdfComponent {
  private readonly http = inject(HttpClient);
  protected readonly events = inject(EventSocketService);

  protected readonly isDragging = signal(false);
  protected readonly fileName = signal('');
  protected readonly tokenId = signal('');
  protected readonly mainnetTxHash = signal('');
  protected readonly contractName = signal('WalletMediaContractV1');
  protected readonly feedback = signal('');

  private uploadedBase64 = '';
  private uploadedMimeType = '';

  constructor() {
    this.events.connect();
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.item(0);
    if (file) {
      void this.readAndTokenize(file);
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) {
      void this.readAndTokenize(file);
    }
  }

  protected uploadToMainnet(): void {
    const tokenId = this.tokenId();
    if (!tokenId) {
      this.feedback.set('Primero tokeniza una imagen.');
      return;
    }

    this.http
      .post<TokenizedImageResponse>(`${environment.apiUrl}/subir-pdf/upload-mainnet`, {
        tokenId,
        contractName: this.contractName()
      })
      .subscribe({
        next: (response) => {
          this.mainnetTxHash.set(response.txHash ?? '');
          this.feedback.set('Imagen publicada en mainnet correctamente.');
        },
        error: (error: { error?: { message?: string } }) => {
          this.feedback.set(error.error?.message ?? 'No se pudo publicar en mainnet.');
        }
      });
  }

  private async readAndTokenize(file: File): Promise<void> {
    this.fileName.set(file.name);
    this.uploadedMimeType = file.type;
    this.uploadedBase64 = await this.fileToBase64(file);

    this.http
      .post<TokenizedImageResponse>(`${environment.apiUrl}/subir-pdf/tokenize-image`, {
        fileName: file.name,
        mimeType: this.uploadedMimeType,
        contentBase64: this.uploadedBase64,
        contractName: this.contractName()
      })
      .subscribe({
        next: (response) => {
          this.tokenId.set(response.tokenId);
          this.feedback.set(`Imagen tokenizada: ${response.tokenId}`);
        },
        error: (error: { error?: { message?: string } }) => {
          this.feedback.set(error.error?.message ?? 'No se pudo tokenizar la imagen.');
        }
      });
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }
}
