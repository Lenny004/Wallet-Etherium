import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EventSocketService, BlockchainEvent } from '../blockchain/event-socket.service';

@Component({
  selector: 'app-dashboard-historial',
  imports: [JsonPipe, RouterLink],
  templateUrl: './dashboard-historial.component.html',
  styleUrl: './dashboard-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHistorialComponent implements OnInit {
  protected readonly events = inject(EventSocketService);

  ngOnInit(): void {
    this.events.connect();
  }

  protected eventTitle(ev: BlockchainEvent): string {
    return ev.type.replace(/\./g, ' › ');
  }
}
