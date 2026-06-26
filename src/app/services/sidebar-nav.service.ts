import { Injectable, signal } from '@angular/core';

export type SidebarTabId = 'evaluator' | 'comparator' | 'groupbuy';

@Injectable({ providedIn: 'root' })
export class SidebarNavService {
  readonly activeTab = signal<SidebarTabId>('evaluator');
  readonly groupBuyPrefillUrl = signal<string | null>(null);
  readonly groupBuyAutoDetect = signal(false);

  openGroupBuy(productUrl: string, autoDetect = true): void {
    this.groupBuyPrefillUrl.set(productUrl);
    this.groupBuyAutoDetect.set(autoDetect);
    this.activeTab.set('groupbuy');
  }

  setTab(tab: SidebarTabId): void {
    this.activeTab.set(tab);
  }
}
