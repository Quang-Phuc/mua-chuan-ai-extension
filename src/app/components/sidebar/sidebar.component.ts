import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiEvaluatorComponent } from '../ai-evaluator/ai-evaluator.component';
import { ProductComparatorComponent } from '../product-comparator/product-comparator.component';
import { GroupBuyingComponent } from '../group-buying/group-buying.component';
import { SidebarNavService, SidebarTabId } from '../../services/sidebar-nav.service';

@Component({
  selector: 'mca-sidebar',
  standalone: true,
  imports: [CommonModule, AiEvaluatorComponent, ProductComparatorComponent, GroupBuyingComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  activeTab: SidebarTabId = 'evaluator';

  constructor(private nav: SidebarNavService) {
    effect(() => {
      this.activeTab = this.nav.activeTab();
    });
  }

  setTab(tab: SidebarTabId): void {
    this.nav.setTab(tab);
  }
}
