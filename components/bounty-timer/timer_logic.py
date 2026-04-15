#!/usr/bin/env python3
"""
SolFoundry Bounty: Countdown Timer Component (Python Implementation)
Objective: Calculate and format time remaining for bounties with urgency logic.
"""

from datetime import datetime, timezone
import json

class BountyCountdown:
    def __init__(self, deadline_iso):
        self.deadline = datetime.fromisoformat(deadline_iso.replace("Z", "+00:00"))

    def get_status(self):
        now = datetime.now(timezone.utc)
        diff = self.deadline - now
        
        seconds = int(diff.total_seconds())
        
        if seconds <= 0:
            return {
                "label": "Expired",
                "urgency": "critical",
                "time_string": "00d 00h 00m",
                "expired": True
            }
            
        days = seconds // 86400
        hours = (seconds % 86400) // 3600
        minutes = (seconds % 3600) // 60
        
        urgency = "normal"
        if seconds < 3600: # < 1 hour
            urgency = "urgent"
        elif seconds < 86400: # < 24 hours
            urgency = "warning"
            
        return {
            "label": "Active",
            "urgency": urgency,
            "time_string": f"{days:02d}d {hours:02d}h {minutes:02d}m",
            "expired": False,
            "total_seconds": seconds
        }

if __name__ == "__main__":
    # Test with a 25-hour deadline
    import time
    test_deadline = datetime.fromtimestamp(time.time() + 90000, tz=timezone.utc).isoformat()
    timer = BountyCountdown(test_deadline)
    print(json.dumps(timer.get_status(), indent=2))
