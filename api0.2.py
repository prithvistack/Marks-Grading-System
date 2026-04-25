"""
┌─────────────────────────────────────────────────────┐
│  Flask API — Bell Curve Grading System              │
│  POST /api/analyze  — full analysis + history       │
│  GET  /api/history  — last 10 sessions              │
└─────────────────────────────────────────────────────┘

Setup:
    pip install flask flask-cors numpy

Run:
    python api.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ═══════════════════════════════════════════════════════
#  STATISTICS & GRADING FUNCTIONS
# ═══════════════════════════════════════════════════════

def compute_statistics(marks):
    """Compute statistical measures for marks array."""
    marks = np.array(marks, dtype=float)
    return {
        "mean": np.mean(marks),
        "median": np.median(marks),
        "std": np.std(marks),
        "variance": np.var(marks),
        "min": np.min(marks),
        "max": np.max(marks),
        "range": np.ptp(marks),
        "p25": np.percentile(marks, 25),
        "p75": np.percentile(marks, 75),
        "p90": np.percentile(marks, 90),
    }


def assign_grade(score, mean, std):
    """
    Assign grade based on standard deviation from mean.
    Returns: (grade, category, grade_points)
    """
    if score >= mean + 1.5 * std:
        return "O", "Outstanding", 10
    elif score >= mean + 1.0 * std:
        return "A+", "Excellent", 9
    elif score >= mean + 0.5 * std:
        return "A", "Very Good", 8
    elif score >= mean + 0.0 * std:
        return "B+", "Good", 7
    elif score >= mean - 0.5 * std:
        return "B", "Above Average", 6
    elif score >= mean - 1.0 * std:
        return "C", "Average", 5
    elif score >= mean - 1.5 * std:
        return "D", "Below Average", 4
    else:
        return "F", "Fail", 0


def compute_z_scores(marks):
    """Calculate z-scores for all marks."""
    marks = np.array(marks, dtype=float)
    mean = np.mean(marks)
    std = np.std(marks)
    if std == 0:
        return np.zeros_like(marks)
    return (marks - mean) / std


def rank_students(marks):
    """
    Return rank for each student (1 = highest marks).
    Handles ties by giving them the same rank.
    """
    sorted_indices = np.argsort(marks)[::-1]  # descending
    ranks = np.empty_like(sorted_indices)
    ranks[sorted_indices] = np.arange(1, len(marks) + 1)
    return ranks


def grade_distribution(grades):
    """Count occurrences of each grade."""
    grade_order = ["O", "A+", "A", "B+", "B", "C", "D", "F"]
    dist = {g: grades.count(g) for g in grade_order}
    return dist


# ═══════════════════════════════════════════════════════
#  HISTORY PERSISTENCE (JSON FILE)
# ═══════════════════════════════════════════════════════

HISTORY_FILE = "analysis_history.json"


def save_to_history(subject, n_students, mean, std, topper_name, topper_marks):
    """Append current analysis to history file."""
    history = load_history()
    history.append({
        "timestamp": datetime.now().isoformat(),
        "subject": subject,
        "n_students": n_students,
        "mean": round(float(mean), 2),
        "std": round(float(std), 2),
        "topper_name": topper_name,
        "topper_marks": float(topper_marks),
    })
    
    # Keep only last 50 entries
    history = history[-50:]
    
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


def load_history():
    """Load history from JSON file."""
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    except:
        return []


# ═══════════════════════════════════════════════════════
#  STUDENT HISTORY SIMULATION
# ═══════════════════════════════════════════════════════

def generate_student_history(name: str, current_mark: float, n_tests: int = 5) -> list:
    """
    Returns a list of `n_tests` past marks (oldest → newest),
    ending exactly at `current_mark`.
    Seeded by student name so values are deterministic.
    """
    seed = sum(ord(c) for c in name)
    rng = np.random.default_rng(seed)

    history = [current_mark]
    for _ in range(n_tests - 1):
        delta = float(rng.normal(loc=0, scale=8))
        prev = float(np.clip(history[-1] + delta, 0, 100))
        history.append(round(prev, 1))

    history.reverse()  # oldest → newest
    history[-1] = current_mark  # pin last point to actual mark
    return history


# ══════════════════════════════════════════════════════
#  POST /api/analyze
#  Body: { "subject": str, "names": [...], "marks": [...] }
# ══════════════════════════════════════════════════════
@app.route("/api/analyze", methods=["POST"])
def analyze():
    body = request.get_json(force=True)

    subject = body.get("subject", "General")
    names = body.get("names", [])
    raw = body.get("marks", [])

    # Validation
    if len(names) < 2 or len(raw) < 2:
        return jsonify({"error": "Need at least 2 students."}), 400
    if len(names) != len(raw):
        return jsonify({"error": "names and marks must be the same length."}), 400

    marks = np.array(raw, dtype=float)

    if np.any((marks < 0) | (marks > 100)):
        return jsonify({"error": "All marks must be between 0 and 100."}), 400

    # Compute statistics
    stats = compute_statistics(marks)
    mean = float(stats["mean"])
    std = float(stats["std"])
    z_scores = compute_z_scores(marks)
    ranks = rank_students(marks)
    grades_list = []

    # Build student data
    students = []
    for i, (name, mark) in enumerate(zip(names, marks)):
        grade, category, points = assign_grade(float(mark), mean, std)
        grades_list.append(grade)
        students.append({
            "name": name,
            "marks": float(mark),
            "grade": grade,
            "category": category,
            "points": points,
            "z_score": round(float(z_scores[i]), 3),
            "rank": int(ranks[i]),
            "history": generate_student_history(name, float(mark)),
        })

    # Grade distribution
    dist = grade_distribution(grades_list)
    
    # Summary stats
    passed = int(np.sum(marks >= 40))
    failed = len(marks) - passed
    top_idx = int(np.argmax(marks))
    bot_idx = int(np.argmin(marks))

    # Save to history
    save_to_history(subject, len(marks), mean, std, names[top_idx], marks[top_idx])

    return jsonify({
        "subject": subject,
        "students": students,
        "stats": {
            "mean": round(mean, 2),
            "median": round(float(stats["median"]), 2),
            "std": round(float(stats["std"]), 2),
            "variance": round(float(stats["variance"]), 2),
            "min": float(stats["min"]),
            "max": float(stats["max"]),
            "range": float(stats["range"]),
            "p25": round(float(stats["p25"]), 2),
            "p75": round(float(stats["p75"]), 2),
            "p90": round(float(stats["p90"]), 2),
        },
        "grade_distribution": dist,
        "summary": {
            "passed": passed,
            "failed": failed,
            "pass_pct": round(passed / len(marks) * 100, 1),
            "topper": {"name": names[top_idx], "marks": float(marks[top_idx])},
            "needs_att": {"name": names[bot_idx], "marks": float(marks[bot_idx])},
        },
    })


# ══════════════════════════════════════════════════════
#  GET /api/history
# ══════════════════════════════════════════════════════
@app.route("/api/history", methods=["GET"])
def history():
    """Return last 10 analysis sessions in reverse chronological order."""
    all_history = load_history()
    return jsonify(all_history[-10:][::-1])


# ══════════════════════════════════════════════════════
#  Health check
# ══════════════════════════════════════════════════════
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Bell Curve API is running"})


if __name__ == "__main__":
    print("\n" + "="*55)
    print("  🔔 Bell Curve Grading API")
    print("  ➜  http://localhost:5000")
    print("  ➜  Keep this terminal open while using the React app")
    print("="*55 + "\n")
    app.run(debug=True, port=5000)