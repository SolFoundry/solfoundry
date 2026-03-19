from fastapi import APIRouter

router = APIRouter()

@router.get('/leaderboard')
def get_leaderboard():
    return [
        {'rank': 1, 'username': 'alice', 'score': 1000, 'medal': 'gold'},
        {'rank': 2, 'username': 'bob', 'score': 800, 'medal': 'silver'},
        {'rank': 3, 'username': 'charlie', 'score': 600, 'medal': 'bronze'}
    ]
