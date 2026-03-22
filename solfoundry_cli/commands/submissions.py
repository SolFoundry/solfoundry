"""Submissions management commands."""

import typer
from typing import Optional
from rich.console import Console
from rich.panel import Panel

from ..api import APIClient, APIError
from ..formatters import format_submission_table, format_submission_json, print_error, print_success, print_info

console = Console()

submissions_app = typer.Typer(help="Manage submissions")


@submissions_app.command("list")
def list_submissions(
    bounty_id: Optional[int] = typer.Option(
        None,
        "--bounty", "-b",
        help="Filter by bounty ID"
    ),
    as_json: bool = typer.Option(
        False,
        "--json", "-j",
        help="Output in JSON format"
    ),
):
    """List submissions."""
    try:
        client = APIClient()
        
        if bounty_id:
            submissions = client.list_submissions(bounty_id)
        else:
            # If no bounty specified, we could list all user's submissions
            # For now, require bounty_id
            print_error("Please specify a bounty ID with --bounty")
            raise typer.Exit(1)
        
        if not submissions:
            console.print("[yellow]No submissions found.[/yellow]")
            raise typer.Exit(0)
        
        if as_json:
            console.print(format_submission_json(submissions))
        else:
            console.print(format_submission_table(submissions))
    
    except APIError as e:
        print_error(f"API Error: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)


@submissions_app.command("review")
def review_submission(
    submission_id: int = typer.Argument(..., help="Submission ID"),
    score: float = typer.Option(..., "--score", "-s", help="Review score (0-10)"),
    comment: str = typer.Option(..., "--comment", "-c", help="Review comment"),
):
    """Review a submission."""
    try:
        client = APIClient()
        
        # Validate score
        if score < 0 or score > 10:
            print_error("Score must be between 0 and 10")
            raise typer.Exit(1)
        
        result = client.review_submission(submission_id, score, comment)
        
        print_success(f"Review submitted for Submission #{submission_id}!")
        print_info(f"Score: {score}/10")
        print_info(f"Comment: {comment}")
    
    except APIError as e:
        print_error(f"API Error: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)


@submissions_app.command("vote")
def vote_submission(
    submission_id: int = typer.Argument(..., help="Submission ID"),
    upvote: bool = typer.Option(
        True,
        "--upvote", "-u",
        help="Upvote the submission"
    ),
    downvote: bool = typer.Option(
        False,
        "--downvote", "-d",
        help="Downvote the submission"
    ),
):
    """Vote on a submission."""
    try:
        client = APIClient()
        
        vote = upvote if upvote or not downvote else False
        
        if downvote and upvote:
            print_error("Cannot both upvote and downvote")
            raise typer.Exit(1)
        
        result = client.vote_submission(submission_id, vote)
        
        vote_str = "upvoted" if vote else "downvoted"
        print_success(f"Submission #{submission_id} {vote_str}!")
    
    except APIError as e:
        print_error(f"API Error: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)


@submissions_app.command("distribute")
def distribute_reward(
    submission_id: int = typer.Argument(..., help="Submission ID"),
    yes: bool = typer.Option(
        False,
        "--yes", "-y",
        help="Skip confirmation prompt"
    ),
):
    """Distribute reward for a completed submission."""
    try:
        client = APIClient()
        
        if not yes:
            console.print(Panel(
                "[yellow]This will distribute the reward to the submitter.[/yellow]\n"
                "This action cannot be undone.",
                title="⚠️  Warning",
                border_style="red"
            ))
            
            confirm = typer.confirm("Are you sure you want to distribute the reward?")
            if not confirm:
                console.print("[yellow]Distribution cancelled[/yellow]")
                raise typer.Exit(0)
        
        result = client.distribute_reward(submission_id)
        
        print_success(f"Reward distributed for Submission #{submission_id}!")
        print_info(f"Transaction hash: {result.get('transaction_hash', 'N/A')}")
    
    except APIError as e:
        print_error(f"API Error: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)
