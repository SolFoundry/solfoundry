from typing import Sequence, Union

Number = Union[int, float]


def average_numeric_score(values: Sequence[Number]) -> float:
    if not values:
        return 0.0
    return float(sum(float(x) for x in values)) / len(values)
