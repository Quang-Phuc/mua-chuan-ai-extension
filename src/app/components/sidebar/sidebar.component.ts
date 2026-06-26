import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiEvaluatorComponent } from '../ai-evaluator/ai-evaluator.component';
import { ProductComparatorComponent } from '../product-comparator/product-comparator.component';
import { GroupBuyingComponent } from '../group-buying/group-buying.component';

type TabId = 'evaluator' | 'comparator' | 'groupbuy';

@Component({
  selector: 'mca-sidebar',
  standalone: true,
  imports: [CommonModule, AiEvaluatorComponent, ProductComparatorComponent, GroupBuyingComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  activeTab: TabId = 'evaluator';

  setTab(tab: TabId): void {
    this.activeTab = tab;
  }
}
