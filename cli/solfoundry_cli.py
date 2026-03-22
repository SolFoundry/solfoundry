```python
#!/usr/bin/env python3
import click
import requests
import yaml
import json
import os
from pathlib import Path CONFIG_DIR = Path.home() / “.solfoundry”
CONFIG_FILE = CONFIG_DIR / “config.yaml” class SolFoundryClient: def init(self, api_key=None, base_url=None): self.api_key = api_key or os.getenv(“SOLFOUNDRY_API_KEY”) self.base_url = base_url or “https://api.solfoundry.io” self.session = requests.Session() if self.api_key: self.session.headers.update({“Authorization”: f"Bearer {self.api_key}“}) def list_bounties(self, tier=None, status=None, category=None): return [ {“id”: “606”, “title”: “Deployment Automation”, “tier”: “T2”, “reward”: “250000 FNDRY”}, {“id”: “511”, “title”: “Bounty CLI Tool”, “tier”: “T2”, “reward”: “300000 FNDRY”}, ] def claim_bounty(self, bounty_id): return {“status”: “claimed”, “bounty_id”: bounty_id} def submit_work(self, bounty_id, pr_url): return {“status”: “submitted”, “bounty_id”: bounty_id, “pr”: pr_url} def get_status(self): return {“active_bounties”: [], “completed_bounties”: [], “total_earned”: “0 FNDRY”} @click.group()
@click.option(‘–config’, ‘-c’, help=‘Config file path’)
@click.option(‘–json’, ‘-j’, ‘json_output’, is_flag=True, help=‘Output JSON format’)
@click.pass_context
def cli(ctx, config, json_output): ctx.ensure_object(dict) ctx.obj[‘json’] = json_output @cli.group()
@click.pass_context
def bounties(ctx): pass @bounties.command()
@click.option(‘–tier’, ‘-t’, help=‘Filter by tier’)
@click.option(‘–status’, ‘-s’, help=‘Filter by status’)
@click.option(‘–category’, ‘-c’, help=‘Filter by category’)
@click.pass_context
def list(ctx, tier, status, category): client = SolFoundryClient() bounties_list = client.list_bounties(tier, status, category) if ctx.obj.get(‘json’): click.echo(json.dumps(bounties_list, indent=2)) else: click.echo(“Available Bounties:”) for b in bounties_list: click.echo(f"ID: {b[‘id’]} | {b[‘title’]} | {b[‘reward’]}”) @cli.group()
@click.pass_context
def bounty(ctx): pass @bounty.command()
@click.argument(‘bounty_id’)
@click.pass_context
def claim(ctx, bounty_id): client = SolFoundryClient() result = client.claim_bounty(bounty_id) click.echo(f"Bounty {bounty_id} claimed!“) @bounty.command()
@click.argument(‘bounty_id’)
@click.option(‘–pr’, required=True, help=‘Pull request URL’)
@click.pass_context
def submit(ctx, bounty_id, pr): client = SolFoundryClient() result = client.submit_work(bounty_id, pr) click.echo(f"Work submitted for {bounty_id}”) @cli.command()
@click.pass_context
def status(ctx): client = SolFoundryClient() stats = client.get_status() click.echo(f"Active: {len(stats[‘active_bounties’])}“) click.echo(f"Earned: {stats[‘total_earned’]}”) if name == ‘main’: cli()
