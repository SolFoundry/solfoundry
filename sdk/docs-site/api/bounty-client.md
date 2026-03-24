# BountyClient

Wraps all `/api/bounties` endpoints.

## Methods

### `list(options?)`

```typescript
list(options?: {
  status?: 'open' | 'in_progress' | 'completed' | 'disputed' | 'paid' | 'cancelled';
  tier?: 1 | 2 | 3;
  limit?: number;
  skip?: number;
}): Promise<BountyListResponse>
```

### `get(id)`

```typescript
get(id: string): Promise<BountyResponse>
```

### `create(data)`

```typescript
create(data: BountyCreate): Promise<BountyResponse>
```

*Requires authentication.*

### `update(id, data)`

```typescript
update(id: string, data: BountyUpdate): Promise<BountyResponse>
```

*Requires authentication.*

### `delete(id)`

```typescript
delete(id: string): Promise<void>
```

*Requires authentication.*

### `submitSolution(bountyId, data)`

```typescript
submitSolution(bountyId: string, data: SubmissionCreate): Promise<SubmissionResponse>
```

### `listSubmissions(bountyId)`

```typescript
listSubmissions(bountyId: string): Promise<SubmissionResponse[]>
```

### `updateSubmissionStatus(bountyId, submissionId, data)`

```typescript
updateSubmissionStatus(
  bountyId: string,
  submissionId: string,
  data: SubmissionStatusUpdate,
): Promise<SubmissionResponse>
```

*Requires authentication.*

### `search(params)`

```typescript
search(params: BountySearchParams): Promise<BountySearchResponse>
```

### `autocomplete(query, limit?)`

```typescript
autocomplete(query: string, limit?: number): Promise<AutocompleteResponse>
```
