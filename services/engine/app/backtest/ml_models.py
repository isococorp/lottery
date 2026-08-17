"""§4.4-EXT Category M — Machine-Learning models (spec §4.21.7 / §4.21.9).

Framed as leak-free walk-forward multiclass classification of the 2-ล่าง value
(00–99): features for target draw i are derived ONLY from draws before i, the
model is trained ONLY on past rows, and it predicts draw i without seeing it.

DISCIPLINE (§4.21.7): a model is reported only if it actually runs in this
environment. Models whose dependency is absent (xgboost, or a deep-learning
framework for LSTM/GRU/Transformer) are reported as NOT AVAILABLE — never mocked.
Expected outcome (§A.4): no model beats random.
"""
from __future__ import annotations

import warnings
from typing import List

import numpy as np

from ..models import Draw
from . import baselines as base_p, metrics

# These models cannot find signal in i.i.d. lottery draws; their optimisers will
# not converge. That is expected — silence the noise, the honest result stands.
warnings.filterwarnings("ignore")

WARMUP = 100
REFIT_EVERY = 40          # expanding-window refit cadence (still walk-forward)
RANDOM_STATE = 42
_MIN_TRAIN = 3            # need 3 prior draws for the lag features

# Deep-learning (sequence) settings — kept small so walk-forward stays tractable.
SEQ_LEN = 8
DL_REFIT_EVERY = 80
DL_EPOCHS = 12
DL_HIDDEN = 24


def _features(draws: List[Draw]):
    """Build a leak-free feature matrix X and labels y (label i uses only draws<i)."""
    X, y, valid = [], [], []
    for k, d in enumerate(draws):
        if k < _MIN_TRAIN or not d.bottom2:
            X.append(None)
            y.append(None)
            continue
        p1, p2, p3 = draws[k - 1].bottom2, draws[k - 2].bottom2, draws[k - 3].bottom2
        if not (p1 and p2 and p3):
            X.append(None)
            y.append(None)
            continue
        feat = [d.date.weekday(), d.date.day, d.date.month,
                int(p1[0]), int(p1[1]), int(p2[0]), int(p2[1]), int(p3[0]), int(p3[1])]
        X.append(feat)
        y.append(int(d.bottom2))
        valid.append(k)
    return X, y, valid


def _runnable_models():
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.naive_bayes import GaussianNB
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    return [
        ("M-LR", "Logistic Regression",
         lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=500))),
        ("M-RF", "Random Forest",
         lambda: RandomForestClassifier(n_estimators=60, random_state=RANDOM_STATE, n_jobs=1)),
        ("M-KNN", "k-NN",
         lambda: KNeighborsClassifier(n_neighbors=7)),
        ("M-GB", "Gradient Boosting",
         lambda: GradientBoostingClassifier(n_estimators=30, random_state=RANDOM_STATE)),
        ("M-NB", "Gaussian NB", lambda: GaussianNB()),
    ]


def _xgb_available() -> bool:
    try:
        import xgboost  # noqa: F401
        return True
    except Exception:
        return False


def _torch_available() -> bool:
    try:
        import torch  # noqa: F401
        return True
    except Exception:
        return False


class _XGBWrapper:
    """XGBClassifier + LabelEncoder (xgboost 2.x needs contiguous 0..K-1 labels,
    but the 2-ล่าง classes present in training are a sparse subset of 00–99)."""

    def __init__(self):
        from xgboost import XGBClassifier
        from sklearn.preprocessing import LabelEncoder
        self.m = XGBClassifier(n_estimators=50, max_depth=4, tree_method="hist",
                               random_state=RANDOM_STATE, verbosity=0, n_jobs=1)
        self.le = LabelEncoder()

    def fit(self, X, y):
        self.m.fit(X, self.le.fit_transform(y))
        return self

    def predict(self, X):
        return self.le.inverse_transform(self.m.predict(X))


def _xgb_make():
    return _XGBWrapper()


def _unavailable_models():
    """Models whose dependency is absent — reported honestly, not mocked (§4.21.7)."""
    out = []
    if not _xgb_available():
        out.append(("M-XGB", "XGBoost", "ไลบรารี xgboost ไม่ได้ติดตั้งในสภาพแวดล้อมนี้"))
    if not _torch_available():
        for code, name in [("M-LSTM", "LSTM"), ("M-GRU", "GRU"), ("M-TF", "Transformer")]:
            out.append((code, name, "ต้องใช้ DL framework (torch) ซึ่งไม่ได้ติดตั้ง"))
    return out


def _build_net(kind: str):
    import torch.nn as nn

    class Net(nn.Module):
        def __init__(self):
            super().__init__()
            self.kind = kind
            self.emb = nn.Embedding(100, DL_HIDDEN)
            if kind == "lstm":
                self.rnn = nn.LSTM(DL_HIDDEN, DL_HIDDEN, batch_first=True)
            elif kind == "gru":
                self.rnn = nn.GRU(DL_HIDDEN, DL_HIDDEN, batch_first=True)
            else:  # transformer encoder
                layer = nn.TransformerEncoderLayer(
                    d_model=DL_HIDDEN, nhead=4, dim_feedforward=DL_HIDDEN * 2,
                    batch_first=True)
                self.rnn = nn.TransformerEncoder(layer, num_layers=1)
            self.head = nn.Linear(DL_HIDDEN, 100)

        def forward(self, x):
            e = self.emb(x)
            if self.kind in ("lstm", "gru"):
                out, _ = self.rnn(e)
                h = out[:, -1, :]
            else:
                h = self.rnn(e).mean(dim=1)
            return self.head(h)

    return Net()


def _run_torch(kind: str, draws: List[Draw], mode: str):
    """Walk-forward training of a sequence model over the last SEQ_LEN 2-ล่าง values."""
    import torch
    import torch.nn as nn

    torch.manual_seed(RANDOM_STATE)
    labels = [int(d.bottom2) if (d.bottom2 and d.bottom2.isdigit()) else None for d in draws]
    n = len(draws)

    def seq_at(i):
        if i < SEQ_LEN or labels[i] is None:
            return None
        s = labels[i - SEQ_LEN:i]
        return None if any(v is None for v in s) else s

    hits, bps = [], []
    model = None
    for i in range(WARMUP, n):
        si = seq_at(i)
        if si is None:
            continue
        if model is None or (i - WARMUP) % DL_REFIT_EVERY == 0:
            X, Y = [], []
            for j in range(SEQ_LEN, i):
                sj = seq_at(j)
                if sj is not None:
                    X.append(sj)
                    Y.append(labels[j])
            if len(set(Y)) < 2:
                continue
            model = _build_net(kind)
            opt = torch.optim.Adam(model.parameters(), lr=0.01)
            lossf = nn.CrossEntropyLoss()
            xt = torch.tensor(X, dtype=torch.long)
            yt = torch.tensor(Y, dtype=torch.long)
            model.train()
            for _ in range(DL_EPOCHS):
                opt.zero_grad()
                loss = lossf(model(xt), yt)
                loss.backward()
                opt.step()
            model.eval()
        with torch.no_grad():
            pred = int(model(torch.tensor([si], dtype=torch.long)).argmax(dim=1)[0])
        bottom2 = f"{pred % 100:02d}"
        hb = metrics.hit_two(bottom2, draws[i].bottom2, mode)
        if hb is not None:
            hits.append(1 if hb else 0)
            bps.append(base_p.p_two(bottom2, mode))
    return metrics.summarize(f"{kind} 2ล่าง", hits, bps)


def _run_one(name_label, make, X, y, draws, mode):
    n = len(draws)
    hits, bps = [], []
    model = None
    Xa = X
    for i in range(WARMUP, n):
        if Xa[i] is None or draws[i].bottom2 is None:
            continue
        if model is None or (i - WARMUP) % REFIT_EVERY == 0:
            tr_X = [Xa[j] for j in range(_MIN_TRAIN, i) if Xa[j] is not None]
            tr_y = [y[j] for j in range(_MIN_TRAIN, i) if Xa[j] is not None]
            if len(set(tr_y)) < 2:
                continue
            model = make()
            model.fit(np.array(tr_X), np.array(tr_y))
        pred = int(model.predict(np.array([Xa[i]]))[0])
        bottom2 = f"{pred % 100:02d}"
        hb = metrics.hit_two(bottom2, draws[i].bottom2, mode)
        if hb is not None:
            hits.append(1 if hb else 0)
            bps.append(base_p.p_two(bottom2, mode))
    return metrics.summarize(f"{name_label} 2ล่าง", hits, bps)


def run_ml_backtest(draws: List[Draw], mode: str = "permutation") -> List[dict]:
    ordered = sorted(draws, key=lambda d: d.date)
    X, y, _valid = _features(ordered)
    out = []
    # sklearn tabular models
    for code, name, make in _runnable_models():
        m = _run_one(name, make, X, y, ordered, mode)
        out.append({"code": code, "name": name, "status": "READY", "bottom2": m.as_dict()})
    # XGBoost (tabular) — real when the library is present
    if _xgb_available():
        m = _run_one("XGBoost", _xgb_make, X, y, ordered, mode)
        out.append({"code": "M-XGB", "name": "XGBoost", "status": "READY",
                    "bottom2": m.as_dict()})
    # Deep-learning sequence models — real when torch is present
    if _torch_available():
        for code, name, kind in [("M-LSTM", "LSTM", "lstm"),
                                 ("M-GRU", "GRU", "gru"),
                                 ("M-TF", "Transformer", "transformer")]:
            m = _run_torch(kind, ordered, mode)
            out.append({"code": code, "name": name, "status": "READY",
                        "bottom2": m.as_dict()})
    # Anything still missing is reported honestly (never mocked, §4.21.7)
    for code, name, reason in _unavailable_models():
        out.append({"code": code, "name": name, "status": "NOT AVAILABLE", "reason": reason})
    return out
