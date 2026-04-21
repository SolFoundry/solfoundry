import { HttpClient } from "../client/HttpClient.js";

/**
 * Base class for resource API modules.
 */
export abstract class BaseApi {
  protected constructor(protected readonly httpClient: HttpClient) {}
}
