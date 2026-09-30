import { HttpClient } from "../client/HttpClient.js";

/**
 * Base class for resource API modules.
 */
export abstract class BaseApi {
  public constructor(protected readonly httpClient: HttpClient) {}
}
