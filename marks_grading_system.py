"""
╔══════════════════════════════════════════════════════════╗
║     MARKS GRADING SYSTEM WITH BELL CURVE                 ║
║     NumPy-Based Python Project                           ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
"""

import numpy as np
import json
import os
from datetime import datetime

# ─────────────────────────────────────────────
#  GRADE BOUNDARIES (based on std deviation)
# ─────────────────────────────────────────────
#
#  Bell Curve Grading Logic:
#  O  : score >= mean + 1.5*std
#  A+ : mean + 1.0*std <= score < mean + 1.5*std
#  A  : mean + 0.5*std <= score < mean + 1.0*std
#  B+ : mean - 0.0*std <= score < mean + 0.5*std
#  B  : mean - 0.5*std <= score < mean - 0.0*std
#  C  : mean - 1.0*std <= score < mean - 0.5*std
#  D  : mean - 1.5*std <= score < mean - 1.0*std
#  F  : score < mean - 1.5*std

HISTORY_FILE = "grading_history.json"

# ─────────────────────────────────────────────
#  CORE NUMPY FUNCTIONS
# ─────────────────────────────────────────────

def compute_statistics(marks):
    stats = {
        "mean"    : np.mean(marks),
        "median"  : np.median(marks),
        "std"     : np.std(marks),
        "variance": np.var(marks),
        "min"     : np.min(marks),
        "max"     : np.max(marks),
        "range"   : np.ptp(marks),
        "p25"     : np.percentile(marks, 25),
        "p75"     : np.percentile(marks, 75),
        "p90"     : np.percentile(marks, 90),
    }
    return stats

def assign_grade(score, mean, std):
    if   score >= mean + 1.5 * std: return "O",  "Outstanding",  10
    elif score >= mean + 1.0 * std: return "A+", "Excellent",     9
    elif score >= mean + 0.5 * std: return "A",  "Very Good",     8
    elif score >= mean - 0.0 * std: return "B+", "Good",          7
    elif score >= mean - 0.5 * std: return "B",  "Above Average", 6
    elif score >= mean - 1.0 * std: return "C",  "Average",       5
    elif score >= mean - 1.5 * std: return "D",  "Below Average", 4
    else:                           return "F",  "Fail",          0

def compute_z_scores(marks):
    mean = np.mean(marks)
    std  = np.std(marks)
    if std == 0:
        return np.zeros_like(marks, dtype=float)
    return (marks - mean) / std

def rank_students(marks):
    sorted_indices = np.argsort(marks)[::-1]
    ranks = np.empty_like(sorted_indices)
    ranks[sorted_indices] = np.arange(1, len(marks) + 1)
    return ranks

def grade_distribution(grades_list):
    grade_order = ["O", "A+", "A", "B+", "B", "C", "D", "F"]
    dist = {}
    for g in grade_order:
        dist[g] = grades_list.count(g)
    return dist

# ─────────────────────────────────────────────
#  BELL CURVE ASCII ART
# ─────────────────────────────────────────────

def draw_bell_curve(marks, stats):
    mean = stats["mean"]
    std  = stats["std"]

    print("\n  📈 BELL CURVE — GRADE ZONES")
    print("  " + "─" * 56)

    width  = 56
    x_vals = np.linspace(mean - 3 * std, mean + 3 * std, width)
    y_vals = np.exp(-0.5 * ((x_vals - mean) / std) ** 2)
    y_vals = y_vals / np.max(y_vals)

    height = 8
    for row in range(height, 0, -1):
        threshold = row / height
        line = ""
        for i, y in enumerate(y_vals):
            x = x_vals[i]
            if y >= threshold:
                if   x >= mean + 1.5 * std: ch = "O"
                elif x >= mean + 1.0 * std: ch = "A"
                elif x >= mean + 0.5 * std: ch = "a"
                elif x >= mean            : ch = "B"
                elif x >= mean - 0.5 * std: ch = "b"
                elif x >= mean - 1.0 * std: ch = "C"
                elif x >= mean - 1.5 * std: ch = "D"
                else:                       ch = "F"
            else:
                ch = " "
            line += ch
        print("  |" + line + "|")

    print("  +" + "─" * width + "+")

    labels = [
        (mean - 1.5*std, "-1.5s"),
        (mean - 1.0*std, "-1s"),
        (mean,           " mean"),
        (mean + 1.0*std, "+1s"),
        (mean + 1.5*std, "+1.5s"),
    ]
    label_line = [" "] * width
    for val, lbl in labels:
        pos = int((val - x_vals[0]) / (x_vals[-1] - x_vals[0]) * (width - 1))
        pos = max(0, min(width - len(lbl) - 1, pos))
        for j, ch in enumerate(lbl):
            if pos + j < width:
                label_line[pos + j] = ch
    print("   " + "".join(label_line))
    print()
    print("  Legend: O=Outstanding  A=Excellent  a=VeryGood")
    print("          B=Good  b=AboveAvg  C=Average  D=Below  F=Fail")
    print("  " + "─" * 56)

# ─────────────────────────────────────────────
#  GRADE DISTRIBUTION BAR CHART
# ─────────────────────────────────────────────

def draw_grade_bar_chart(dist, total):
    print("\n  📊 GRADE DISTRIBUTION")
    print("  " + "─" * 46)
    grade_labels = {
        "O" : "O  Outstanding ",
        "A+": "A+ Excellent   ",
        "A" : "A  Very Good   ",
        "B+": "B+ Good        ",
        "B" : "B  Above Avg   ",
        "C" : "C  Average     ",
        "D" : "D  Below Avg   ",
        "F" : "F  Fail        ",
    }
    max_count = max(dist.values()) if max(dist.values()) > 0 else 1
    bar_width  = 20

    for grade, label in grade_labels.items():
        count   = dist[grade]
        percent = (count / total * 100) if total > 0 else 0
        bars    = int((count / max_count) * bar_width)
        bar_str = "█" * bars + "░" * (bar_width - bars)
        print(f"  {label} |{bar_str}| {count:2d} ({percent:4.1f}%)")

    print("  " + "─" * 46)

# ─────────────────────────────────────────────
#  REPORT PRINTER
# ─────────────────────────────────────────────

def print_statistics(stats, subject, total):
    print("\n" + "═" * 60)
    print(f"       📋 STATISTICS REPORT — {subject.upper()}")
    print("═" * 60)
    print(f"  👥 Total Students  : {total}")
    print(f"  📅 Date            : {datetime.now().strftime('%d %b %Y, %I:%M %p')}")
    print("─" * 60)
    print(f"  📌 Mean (Average)  : {stats['mean']:.2f}")
    print(f"  📌 Median          : {stats['median']:.2f}")
    print(f"  📌 Std Deviation   : {stats['std']:.2f}")
    print(f"  📌 Variance        : {stats['variance']:.2f}")
    print(f"  📌 Highest Mark    : {stats['max']:.0f}")
    print(f"  📌 Lowest Mark     : {stats['min']:.0f}")
    print(f"  📌 Range           : {stats['range']:.0f}")
    print(f"  📌 25th Percentile : {stats['p25']:.2f}")
    print(f"  📌 75th Percentile : {stats['p75']:.2f}")
    print(f"  📌 90th Percentile : {stats['p90']:.2f}")
    print("═" * 60)

def print_student_report(names, marks, stats):
    mean     = stats["mean"]
    std      = stats["std"]
    z_scores = compute_z_scores(marks)
    ranks    = rank_students(marks)

    print("\n" + "═" * 75)
    print("  📝 INDIVIDUAL STUDENT REPORT")
    print("═" * 75)
    print(f"  {'Rank':<5} {'Name':<20} {'Marks':>6} {'Z-Score':>8} {'Grade':<5} {'Category':<15} {'Points':>6}")
    print("─" * 75)

    order = np.argsort(marks)[::-1]
    for i in order:
        grade, category, points = assign_grade(marks[i], mean, std)
        z    = z_scores[i]
        rank = ranks[i]
        print(f"  {rank:<5} {names[i]:<20} {marks[i]:>6.0f} {z:>+8.2f} {grade:<5} {category:<15} {points:>6}")

    print("═" * 75)

def print_topper_and_bottom(names, marks, stats):
    mean    = stats["mean"]
    std     = stats["std"]
    top_idx = int(np.argmax(marks))
    bot_idx = int(np.argmin(marks))

    top_grade, top_cat, _ = assign_grade(marks[top_idx], mean, std)
    bot_grade, bot_cat, _ = assign_grade(marks[bot_idx], mean, std)

    print("\n  🏆 CLASS TOPPER")
    print(f"     Name  : {names[top_idx]}")
    print(f"     Marks : {marks[top_idx]:.0f}  |  Grade: {top_grade} ({top_cat})")
    print("\n  ⚠️  NEEDS ATTENTION")
    print(f"     Name  : {names[bot_idx]}")
    print(f"     Marks : {marks[bot_idx]:.0f}  |  Grade: {bot_grade} ({bot_cat})")

# ─────────────────────────────────────────────
#  INPUT HELPERS
# ─────────────────────────────────────────────

def input_marks_manually():
    print("\n  How many students?")
    while True:
        try:
            n = int(input("  Enter count: ").strip())
            if n < 2:
                print("  Need at least 2 students.")
                continue
            break
        except ValueError:
            print("  Please enter a valid number.")

    names = []
    marks = []
    print(f"\n  Enter name and marks for {n} students (marks out of 100):\n")
    for i in range(n):
        name = input(f"  Student {i+1} Name  : ").strip()
        if not name:
            name = f"Student{i+1}"
        while True:
            try:
                mark = float(input(f"  Student {i+1} Marks : ").strip())
                if not (0 <= mark <= 100):
                    print("  Marks must be between 0 and 100.")
                    continue
                break
            except ValueError:
                print("  Please enter a valid number.")
        names.append(name)
        marks.append(mark)

    return names, np.array(marks, dtype=float)

def input_marks_quick():
    print("\n  Enter marks separated by spaces (e.g. 78 85 62 90 55):")
    while True:
        try:
            raw   = input("  Marks : ").strip().split()
            marks = np.array([float(m) for m in raw])
            if len(marks) < 2:
                print("  Enter at least 2 marks.")
                continue
            if np.any((marks < 0) | (marks > 100)):
                print("  All marks must be between 0 and 100.")
                continue
            break
        except ValueError:
            print("  Invalid input. Use numbers only.")

    names = [f"Student{i+1}" for i in range(len(marks))]
    return names, marks

def demo_data():
    names = [
        "Aarav Shah",  "Priya Nair",  "Rohit Verma", "Sneha Patil",
        "Kiran Rao",   "Meera Joshi", "Arjun Kumar", "Divya Menon",
        "Yash Gupta",  "Ananya Singh","Rahul Desai", "Pooja Iyer",
        "Nikhil More", "Tanya Bose",  "Sameer Khan"
    ]
    marks = np.array([
        88, 72, 95, 61, 78, 83, 55, 90,
        67, 74, 48, 85, 70, 92, 63
    ], dtype=float)
    return names, marks

# ─────────────────────────────────────────────
#  HISTORY MANAGER
# ─────────────────────────────────────────────

def save_to_history(subject, total, mean, std, top_name, top_marks):
    history = load_history()
    entry = {
        "timestamp" : datetime.now().strftime("%d-%m-%Y %H:%M"),
        "subject"   : subject,
        "students"  : total,
        "mean"      : round(float(mean), 2),
        "std"       : round(float(std), 2),
        "topper"    : top_name,
        "top_marks" : float(top_marks)
    }
    history.append(entry)
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)

def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    return []

def show_history():
    history = load_history()
    if not history:
        print("\n  No history found.")
        return
    print("\n" + "═" * 60)
    print("         📂 SESSION HISTORY (Last 10)")
    print("═" * 60)
    for i, e in enumerate(history[-10:][::-1], 1):
        print(f"  {i}. [{e['timestamp']}] {e['subject']}")
        print(f"     Students: {e['students']}  |  Mean: {e['mean']}  |  Std: {e['std']}")
        print(f"     Topper  : {e['topper']} ({e['top_marks']:.0f} marks)")
        print()

# ─────────────────────────────────────────────
#  MAIN FLOW
# ─────────────────────────────────────────────

def run_analysis(names, marks, subject):
    stats       = compute_statistics(marks)
    mean        = stats["mean"]
    std         = stats["std"]
    grades_list = [assign_grade(m, mean, std)[0] for m in marks]
    dist        = grade_distribution(grades_list)

    print_statistics(stats, subject, len(marks))
    draw_bell_curve(marks, stats)
    draw_grade_bar_chart(dist, len(marks))
    print_student_report(names, marks, stats)
    print_topper_and_bottom(names, marks, stats)

    passed = int(np.sum(marks >= 40))
    failed = len(marks) - passed
    print(f"\n  ✅ Passed : {passed} students")
    print(f"  ❌ Failed : {failed} students")
    print(f"  📊 Pass % : {passed/len(marks)*100:.1f}%")

    top_idx = int(np.argmax(marks))
    save_to_history(subject, len(marks), mean, std, names[top_idx], marks[top_idx])
    print("\n  ✅ Session saved to history.")

# ─────────────────────────────────────────────
#  MAIN MENU
# ─────────────────────────────────────────────

def main():
    print("\n" + "╔" + "═"*54 + "╗")
    print("║    📊  MARKS GRADING SYSTEM WITH BELL CURVE        ║")
    print("║    NumPy-Based | 1st Year Engineering Project      ║")
    print("╚" + "═"*54 + "╝")

    while True:
        print("\n  MAIN MENU")
        print("  ─────────────────────────────────")
        print("  1. Enter marks with student names")
        print("  2. Quick entry (marks only)")
        print("  3. Run demo (15 students)")
        print("  4. View history")
        print("  5. Exit")
        print()

        choice = input("  Enter choice (1-5): ").strip()

        if choice in ("1", "2", "3"):
            subject = input("\n  Enter subject name (e.g. Maths): ").strip()
            if not subject:
                subject = "General"

            if choice == "1":
                names, marks = input_marks_manually()
            elif choice == "2":
                names, marks = input_marks_quick()
            else:
                names, marks = demo_data()
                print("\n  ✅ Demo data loaded — 15 students.")

            run_analysis(names, marks, subject)

        elif choice == "4":
            show_history()

        elif choice == "5":
            print("\n  Thank you! Keep learning. 👋\n")
            break

        else:
            print("  Invalid choice. Enter 1-5.")

# ─────────────────────────────────────────────
if __name__ == "__main__":
    main()