"""
┌─────────────────────────────────────────────────────┐
│  Flask API — Bridge for marks_grading_system.py     │
│  Exposes /api/analyze  (POST)                       │
│  Exposes /api/history  (GET)                        │
└─────────────────────────────────────────────────────┘

Setup (one time):
    pip install flask flask-cors numpy

Run:
    python api.py

The React app will call http://localhost:5000/api/analyze
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np

# ── import everything from your existing file ──────────────────────────────
from marks_grading_system import (
    compute_statistics,
    assign_grade,
    compute_z_scores,
    rank_students,
    grade_distribution,
    save_to_history,
    load_history,
)

app = Flask(__name__)
CORS(app)   # allows React (localhost:5173) to talk to Flask (localhost:5000)


# ══════════════════════════════════════════════════════
#  POST /api/analyze
#  Body: { "subject": str, "names": [...], "marks": [...] }
#  Returns full analysis JSON
# ══════════════════════════════════════════════════════
@app.route("/api/analyze", methods=["POST"])
def analyze():
    body = request.get_json(force=True)

    subject = body.get("subject", "General")
    names   = body.get("names", [])
    raw     = body.get("marks", [])

    # ── validate ───────────────────────────────────────
    if len(names) < 2 or len(raw) < 2:
        return jsonify({"error": "Need at least 2 students."}), 400

    if len(names) != len(raw):
        return jsonify({"error": "names and marks must be the same length."}), 400

    marks = np.array(raw, dtype=float)

    if np.any((marks < 0) | (marks > 100)):
        return jsonify({"error": "All marks must be between 0 and 100."}), 400

    # ── core computation (your Python functions) ────────
    stats    = compute_statistics(marks)
    mean     = float(stats["mean"])
    std      = float(stats["std"])

    z_scores = compute_z_scores(marks)
    ranks    = rank_students(marks)

    students = []
    grades_list = []
    for i, (name, mark) in enumerate(zip(names, marks)):
        grade, category, points = assign_grade(float(mark), mean, std)
        grades_list.append(grade)
        students.append({
            "name"    : name,
            "marks"   : float(mark),
            "grade"   : grade,
            "category": category,
            "points"  : points,
            "z_score" : round(float(z_scores[i]), 3),
            "rank"    : int(ranks[i]),
        })

    dist = grade_distribution(grades_list)

    passed = int(np.sum(marks >= 40))
    failed = len(marks) - passed

    top_idx = int(np.argmax(marks))
    bot_idx = int(np.argmin(marks))

    # ── save to history (your existing function) ────────
    save_to_history(subject, len(marks), mean, std, names[top_idx], marks[top_idx])

    # ── build response ──────────────────────────────────
    return jsonify({
        "subject" : subject,
        "students": students,
        "stats": {
            "mean"    : round(mean, 2),
            "median"  : round(float(stats["median"]), 2),
            "std"     : round(float(stats["std"]), 2),
            "variance": round(float(stats["variance"]), 2),
            "min"     : float(stats["min"]),
            "max"     : float(stats["max"]),
            "range"   : float(stats["range"]),
            "p25"     : round(float(stats["p25"]), 2),
            "p75"     : round(float(stats["p75"]), 2),
            "p90"     : round(float(stats["p90"]), 2),
        },
        "grade_distribution": dist,
        "summary": {
            "passed"   : passed,
            "failed"   : failed,
            "pass_pct" : round(passed / len(marks) * 100, 1),
            "topper"   : { "name": names[top_idx], "marks": float(marks[top_idx]) },
            "needs_att": { "name": names[bot_idx], "marks": float(marks[bot_idx]) },
        }
    })


# ══════════════════════════════════════════════════════
#  GET /api/history
#  Returns last 10 sessions from grading_history.json
# ══════════════════════════════════════════════════════
@app.route("/api/history", methods=["GET"])
def history():
    return jsonify(load_history()[-10:][::-1])


# ══════════════════════════════════════════════════════
if __name__ == "__main__":
    print("\n  🧬 Grading API running at http://localhost:5000")
    print("  Keep this terminal open while using the React app.\n")
    app.run(debug=True, port=5000)
