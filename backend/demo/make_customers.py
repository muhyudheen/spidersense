"""Seeded demo dataset with planted privacy leaks (fake values only: example.com emails, test card numbers)."""
from pathlib import Path

import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
n = 600
first = ["alex", "sam", "priya", "omar", "lena", "ravi", "mei", "john", "fatima", "luca"]
df = pd.DataFrame({
    "customer_id": np.arange(10001, 10001 + n),
    "age": rng.integers(18, 75, n),
    "plan": rng.choice(["basic", "plus", "pro"], n, p=[0.5, 0.3, 0.2]),
    "monthly_spend": rng.gamma(2.0, 25.0, n).round(2),
    "tenure_months": rng.integers(1, 72, n),
    "support_tickets": rng.poisson(1.2, n),
})
df["contact_email"] = [f"{rng.choice(first)}.{i}@example.com" for i in range(n)]
notes = np.array(["Asked about upgrade.", "Billing question resolved.", "No issues.", "Requested refund.",
                  "Happy with service."], dtype=object)[rng.integers(0, 5, n)]
leak = rng.random(n)
notes = np.where(leak < 0.05, [f"Customer shared login: password={rng.choice(first)}{rng.integers(100, 999)}" for _ in range(n)], notes)
notes = np.where((leak >= 0.05) & (leak < 0.10), [f"Call back on +91 98{rng.integers(10000000, 99999999)}" for _ in range(n)], notes)
notes = np.where((leak >= 0.10) & (leak < 0.13), "Paid by card 4111 1111 1111 1111, please refund.", notes)
notes = np.where((leak >= 0.13) & (leak < 0.15), "Integration set up with api_key=demo-not-a-real-key-7f3a9c", notes)
df["support_notes"] = notes
churn_score = -2 + 0.04 * df["support_tickets"] * 10 - 0.03 * df["tenure_months"] + (df["plan"] == "basic") * 0.8
df["churned"] = (rng.random(n) < 1 / (1 + np.exp(-churn_score))).astype(int)
df.to_csv(Path(__file__).parent / "customers.csv", index=False)
print(df.shape, df["churned"].mean().round(2))
