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
  private readonly credentialsStorageKey = 'wallet_credentials';

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
      this.persistCredentials();
      return;
    }

    const cached = sessionStorage.getItem(this.credentialsStorageKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          walletAddress?: string;
          seedPhrase?: string;
          did?: string;
        };

        if (parsed.walletAddress) {
          this.walletAddress = parsed.walletAddress;
          this.seedPhrase = parsed.seedPhrase ?? '';
          this.did = parsed.did ?? '';
          return;
        }
      } catch {
        sessionStorage.removeItem(this.credentialsStorageKey);
      }
    }

    void this.router.navigateByUrl('/register');
  }

  async copyToClipboard(text: string, field: string): Promise<void> {
    if (!text) {
      this.copied[field] = false;
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        this.copyWithFallback(text);
      }
      this.markCopied(field);
    } catch {
      this.copyWithFallback(text);
      this.markCopied(field);
    }
  }

  continueToLogin(): void {
    sessionStorage.removeItem(this.credentialsStorageKey);
    void this.router.navigateByUrl('/login');
  }

  private persistCredentials(): void {
    sessionStorage.setItem(
      this.credentialsStorageKey,
      JSON.stringify({
        walletAddress: this.walletAddress,
        seedPhrase: this.seedPhrase,
        did: this.did,
      })
    );
  }

  private copyWithFallback(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  private markCopied(field: string): void {
    this.copied[field] = true;
    setTimeout(() => {
      this.copied[field] = false;
    }, 2000);
  }
}