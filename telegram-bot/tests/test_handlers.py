"""Tests for bot/handlers.py — filter parsing."""
from bot.handlers import parse_filter_args


def test_parse_filter_empty():
    f, err = parse_filter_args("")
    # Empty string = signal caller to show current filter status
    assert f is None
    assert err is None


def test_parse_filter_clear():
    f, err = parse_filter_args("clear")
    assert f is None
    assert err is None


def test_parse_filter_tier():
    f, err = parse_filter_args("tier:1,2")
    assert err is None
    assert f.tiers == ["1", "2"]


def test_parse_filter_type():
    f, err = parse_filter_args("type:feature,bug")
    assert err is None
    assert f.types == ["feature", "bug"]


def test_parse_filter_min():
    f, err = parse_filter_args("min:500")
    assert err is None
    assert f.min_reward == 500


def test_parse_filter_combined():
    f, err = parse_filter_args("tier:2,3 type:feature min:500")
    assert err is None
    assert f.tiers == ["2", "3"]
    assert f.types == ["feature"]
    assert f.min_reward == 500


def test_parse_filter_invalid_min():
    f, err = parse_filter_args("min:abc")
    assert f is None
    assert "Invalid min value" in err
