interface BountyPayload {
  title: string;
  description: string;
  repository: string;
  issueNumber: number;
  issueUrl: string;
  rewardAmount: number;
  rewardToken: string;
  tier: string;
}

interface BountyResponse {
  id: string;
  url: string;
}

export async function createBounty(
  apiUrl: string,
  apiKey: string,
  payload: BountyPayload
): Promise<BountyResponse> {
  const response = await fetch(`${apiUrl}/api/bounties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SolFoundry API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as Record<string, any>;
  const bountyData = data.bounty || data;
  return {
    id: bountyData.id || '',
    url: bountyData.url || `${apiUrl}/bounties/${bountyData.id || ''}`,
  };
}
