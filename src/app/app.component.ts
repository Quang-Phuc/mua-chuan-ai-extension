import { Component } from '@angular/core';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { GroupBuyingComponent } from './components/group-buying/group-buying.component';

@Component({
  selector: 'mca-root',
  standalone: true,
  imports: [SidebarComponent, GroupBuyingComponent],
  template: `
    @if (lobbyOnly) {
      <div class="lobby-shell">
        <header class="lobby-header">
          <span class="lobby-brand">🛍️ Mua Chuẩn AI</span>
          <span class="lobby-sub">Phòng chờ gom đơn</span>
        </header>
        <mca-group-buying [lobbyOnly]="true" />
      </div>
    } @else {
      <mca-sidebar />
    }
  `,
  styles: [`
    :host { display: block; height: 100vh; }
    .lobby-shell {
      max-width: 480px;
      margin: 0 auto;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #f8fafc;
    }
    .lobby-header {
      padding: 14px 16px;
      background: linear-gradient(135deg, #ee4d2d, #ff7337);
      color: #fff;
    }
    .lobby-brand { font-weight: 800; font-size: 15px; display: block; }
    .lobby-sub { font-size: 11px; opacity: 0.9; }
  `]
})
export class AppComponent {
  lobbyOnly = /\/keo\/\d+/i.test(window.location.pathname);
}
