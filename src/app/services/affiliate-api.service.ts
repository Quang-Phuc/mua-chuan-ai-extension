import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AffiliateConvertResponse {
  affiliateUrl: string;
  configured: boolean;
}

@Injectable({ providedIn: 'root' })
export class AffiliateApiService {
  constructor(private http: HttpClient) {}

  convert(productUrl: string): Observable<AffiliateConvertResponse> {
    return this.http.post<AffiliateConvertResponse>(
      `${environment.apiBaseUrl}/api/shoppe/affiliate/convert`,
      { url: productUrl }
    );
  }
}
