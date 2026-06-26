import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiEvaluatorComponent } from '../ai-evaluator/ai-evaluator.component';
import { ProductComparatorComponent } from '../product-comparator/product-comparator.component';

type TabId = 'evaluator' | 'comparator';

@Component({
  selector: 'mca-sidebar',
  standalone: true,
  imports: [CommonModule, AiEvaluatorComponent, ProductComparatorComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  activeTab: TabId = 'evaluator';

  setTab(tab: TabId): void {
    this.activeTab = tab;
  }
}
