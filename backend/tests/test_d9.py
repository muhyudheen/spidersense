"""D9 privacy: secrets and personal data are found and always masked; clean data stays quiet."""
import pandas as pd
import pytest

from d9 import check_d9, luhn_ok, mask

CUSTOMERS = pd.read_csv("demo/customers.csv")


def by_column(findings):
    return {f["location"]["column"]: f for f in findings}


def test_customers_leaks_are_found():
    found = by_column(check_d9(CUSTOMERS))
    assert set(found) == {"contact_email", "support_notes"}
    assert found["contact_email"]["severity"] == "medium" and set(found["contact_email"]["evidence"]["found"]) == {"email"}
    assert found["support_notes"]["severity"] == "high"
    assert set(found["support_notes"]["evidence"]["found"]) == {"credential", "card_number", "phone"}


def test_evidence_never_contains_the_secret():
    text = str(check_d9(CUSTOMERS))
    assert "4111 1111 1111 1111" not in text and "4111111111111111" not in text
    assert "demo-not-a-real-key" not in text
    for email in CUSTOMERS["contact_email"].head(50):
        assert email not in text


@pytest.mark.parametrize("name", ["prelim", "titanic", "breast_cancer", "wine", "diabetes"])
def test_no_false_alarm_on_the_other_demos(name):
    assert check_d9(pd.read_csv(f"demo/{name}.csv")) == []


def test_provider_key_formats_are_caught():
    df = pd.DataFrame({"note": ["key AIza" + "A" * 35, "token ghp_" + "b" * 36, "aws AKIA" + "C" * 16, "fine"]})
    assert check_d9(df)[0]["evidence"]["found"] == {"api_key": 3}


def test_random_long_numbers_are_not_cards():
    assert luhn_ok("4111 1111 1111 1111") and not luhn_ok("1234 5678 9012 3456")


def test_numeric_columns_are_skipped():
    assert check_d9(pd.DataFrame({"n": [4111111111111111, 5500000000000004]})) == []


def test_mask():
    assert mask("alex.1@example.com") == "a***@example.com"
    assert mask("password=hunter22") == "pass***22"
