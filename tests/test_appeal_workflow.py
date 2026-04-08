import asyncio
import sys
import unittest
from pathlib import Path

from faker import Faker
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.api.appeals import appeals, retrieve_all_appeals, submit_appeal  # noqa: E402


class TestAppealWorkflow(unittest.TestCase):
    def setUp(self) -> None:
        self.fake = Faker()
        self.fake.seed_instance(858)
        appeals.clear()

    def test_submit_and_list_appeals(self) -> None:
        async def _run() -> None:
            reviewer = self.fake.name()
            payload = {"reviewer": reviewer, "reason": self.fake.sentence()}
            out = await submit_appeal(payload)
            self.assertEqual(out["reviewer"], reviewer)
            listed = await retrieve_all_appeals()
            self.assertEqual(len(listed), 1)
            self.assertEqual(listed[0]["reviewer"], reviewer)

        asyncio.run(_run())

    def test_missing_reviewer_returns_400(self) -> None:
        async def _run() -> None:
            with self.assertRaises(HTTPException) as ctx:
                await submit_appeal({"reason": self.fake.sentence()})
            self.assertEqual(ctx.exception.status_code, 400)

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
