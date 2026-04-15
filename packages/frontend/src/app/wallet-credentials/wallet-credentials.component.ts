import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-wallet-credentials',
  imports: [CommonModule],
  templateUrl: './wallet-credentials.component.html',
  styleUrl: './wallet-credentials.component.css',
})
export class WalletCredentialsComponent implements OnInit {
  private readonly router = inject(Router);

  walletAddress = '';
  seedPhrase = '';
  did = '';
  copied: Record<string, boolean> = {};

  ngOnInit(): void {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state ?? history.state;

    if (state && typeof state['walletAddress'] === 'string') {
      this.walletAddress = state['walletAddress'];
      this.seedPhrase = state['seedPhrase'] ?? '';
      this.did = state['did'] ?? '';
      return;
    }

    void this.router.navigateByUrl('/register');
  }

  async copyToClipboard(text: string, field: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied[field] = true;
      setTimeout(() => {
        this.copied[field] = false;
      }, 2000);
    } catch {
      this.copied[field] = false;
    }
  }

  continueToLogin(): void {
    void this.router.navigateByUrl('/login');
  }
}