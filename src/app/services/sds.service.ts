import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  AppSettings,
  DEFAULT,
  DIAGNOSTICS,
  SdsNamespace,
  SdsStream,
  SdsType,
  SETTINGS,
} from '~/models';

@Injectable({ providedIn: 'root' })
export class SdsService {
  /** The base URL for namespaces in the SDS instance and tenant */
  get baseUrl(): string {
    return `${this.settings.Resource}/api/${this.settings.ApiVersion}/Tenants/${this.settings.TenantId}/Namespaces`;
  }

  constructor(
    @Inject(SETTINGS) public settings: AppSettings,
    public http: HttpClient
  ) {}

  /**
   * Creates a representation of an EDS namespace as a full SDS Namespace object
   * @param id The ID of the EDS namespace, 'default' or 'diagnostics'
   */
  edsNamespace(id: typeof DEFAULT | typeof DIAGNOSTICS): SdsNamespace {
    return {
      Id: id,
      Description: '',
      InstanceId: '',
      Region: '',
      Self: `${this.baseUrl}/${id}`,
    };
  }

  /**
   * Gets hard-coded namespaces from EDS, or makes an HTTP request for list of namespaces from OCS, see
   * {@link https://ocs-docs.osisoft.com/Content_Portal/Documentation/Management/Account_Namespace_1.html#get-all-namespaces
   * |OCS Documentation}
   */
  getNamespaces(): Observable<SdsNamespace[]> {
    if (this.settings.TenantId === DEFAULT) {
      return of([this.edsNamespace(DEFAULT), this.edsNamespace(DIAGNOSTICS)]);
    } else {
      return this.http.get(this.baseUrl).pipe(
        map((r) => r as SdsNamespace[]),
        catchError(this.handleError('Error getting namespaces'))
      );
    }
  }

  /**
   * Makes a request for types in a specified namespace, see
   * {@link https://ocs-docs.osisoft.com/Content_Portal/Documentation/SequentialDataStore/SDS_Types.html#get-types|OCS Documentation} and
   * {@link https://osisoft.github.io/Edge-Data-Store-Docs/V1/SDS/Types/SDSType_API_1-0.html#get-types|EDS Documentation}
   * @param namespace The namespace ID to query types against
   */
  getTypes(namespace: SdsNamespace): Observable<SdsType[]> {
    return this.http.get(`${namespace.Self}/Types`).pipe(
      map((r) => r as SdsType[]),
      catchError(this.handleError('Error getting types'))
    );
  }

  /**
   * Makes a request for streams in a specified namespace matching a search pattern, see
   * {@link https://ocs-docs.osisoft.com/Content_Portal/Documentation/SequentialDataStore/SDS_Streams.html#get-streams|OCS Documentation}
   * and {@link https://osisoft.github.io/Edge-Data-Store-Docs/V1/SDS/Streams/Sds_Streams_API_1-0.html#get-streams| EDS Documentation}
   * @param namespace The namespace ID to query streams against
   * @param query The string search for streams
   */
  getStreams(namespace: SdsNamespace, query: string): Observable<SdsStream[]> {
    return this.http
      .get(`${namespace.Self}/Streams?query=${query || ''}*`)
      .pipe(
        map((r) => r as SdsStream[]),
        catchError(this.handleError('Error getting streams'))
      );
  }

  /**
   * Makes a request for the latest value from a stream in a specified namespace, see
   * {@link https://ocs-docs.osisoft.com/Content_Portal/Documentation/SequentialDataStore/Reading_Data_API.html#get-last-value
   * |OCS Documentation} and
   * {@link https://osisoft.github.io/Edge-Data-Store-Docs/V1/SDS/Read%20data/Reading_Data_API_1-0.html#get-last-value|EDS Documentation}
   * @param namespace The namespace ID of the specified stream
   * @param stream The stream ID to query last value against
   */
  getLastValue(namespace: SdsNamespace, stream: string): Observable<any> {
    return this.http
      .get(`${namespace.Self}/Streams/${stream}/Data/Last`)
      .pipe(catchError(this.handleError('Error getting last value')));
  }

  /**
   * Makes a request for a range of values from a stream in a specified namespace, see
   * {@link https://ocs-docs.osisoft.com/Content_Portal/Documentation/SequentialDataStore/Reading_Data_API.html#range|OCS Documentation} and
   * {@link https://osisoft.github.io/Edge-Data-Store-Docs/V1/SDS/Read%20data/Reading_Data_API_1-0.html#range|EDS Documentation}
   * @param namespace The namespace ID of the specified stream
   * @param stream The stream ID to query range values against
   * @param startIndex The starting index of the query range
   * @param count The number of values to request
   * @param reversed Optional direction of the request. By default, range request move forward from the startIndex, but a reversed request
   * moves backward from the startIndex.
   */
  getRangeValues(
    namespace: SdsNamespace,
    stream: string,
    startIndex: string,
    count: number,
    reversed = false
  ): Observable<any[]> {
    return this.http
      .get(
        `${
          namespace.Self
        }/Streams/${stream}/Data?startIndex=${startIndex}&count=${count}${
          reversed ? '&reversed=true' : ''
        }`,
        {
          headers: {
            Accept: 'application/json',
            'Accept-Verbosity': 'verbose',
          },
        }
      )
      .pipe(
        map((r) => r as any[]),
        catchError(this.handleError('Error getting range values'))
      );
  }

  handleError(msg: string): (error: HttpErrorResponse) => Observable<never> {
    return (error: HttpErrorResponse): Observable<never> => {
      if (error.error instanceof ErrorEvent) {
        // A client-side or network error occurred. Handle it accordingly.
        console.error('An error occurred:', error.error.message);
      } else {
        // The SDS backend returned an unsuccessful response code.
        // The response body may contain clues as to what went wrong.
        console.error(
          `SDS backend returned code ${error.status}, ` +
            `body was: ${error.error}`
        );
      }
      // Return an observable with a user-facing error message.
      return throwError(msg);
    };
  }
}
