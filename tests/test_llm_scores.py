import sys
import unittest
from pathlib import Path

from faker import Faker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.api.llm_scores import average_numeric_score  # noqa: E402


class TestLLMScores(unittest.TestCase):
    def test_average_numeric_score_with_fake_values(self) -> None:
        fake = Faker()
        fake.seed_instance(858)
        n = fake.random_int(min=2, max=8)
        scores = [float(fake.random_int(min=1, max=5)) for _ in range(n)]
        expected = sum(scores) / n
        self.assertAlmostEqual(average_numeric_score(scores), expected)

    def test_empty_scores_average_is_zero(self) -> None:
        self.assertEqual(average_numeric_score([]), 0.0)


if __name__ == "__main__":
    unittest.main()
