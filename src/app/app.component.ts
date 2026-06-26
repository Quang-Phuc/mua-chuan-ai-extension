import { Component } from '@angular/core';
import { SidebarComponent } from './components/sidebar/sidebar.component';

@Component({
  selector: 'mca-root',
  standalone: true,
  imports: [SidebarComponent],
  template: `<mca-sidebar />`,
  styles: [`:host { display: block; height: 100vh; }`]
})
export class AppComponent {}
