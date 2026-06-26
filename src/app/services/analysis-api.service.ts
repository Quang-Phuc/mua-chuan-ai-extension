import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AnalysisRequest, AnalysisResponse } from '../models/analysis.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AnalysisApiService {
  constructor(private http: HttpClient) {}

  analyze(request: AnalysisRequest): Observable<AnalysisResponse> {
    return this.http.post<AnalysisResponse>(
      `${environment.apiBaseUrl}/api/shoppe/ai/analyze`,
      request
    );
  }
}
