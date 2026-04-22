from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np

app = FastAPI()

class Data(BaseModel):
    names: list[str]
    marks: list[float]
    subject: str

def compute_statistics(marks):
    return {
        "mean": float(np.mean(marks)),
        "std": float(np.std(marks)),
        "median": float(np.median(marks)),
        "variance": float(np.var(marks)),
        "min": float(np.min(marks)),
        "max": float(np.max(marks)),
        "p90": float(np.percentile(marks, 90))
    }

def assign_grade(score, mean, std):
    if score >= mean + 1.5 * std: return "O", "Outstanding", 0
    elif score >= mean + 1.0 * std: return "A+", "Excellent", 1
    elif score >= mean + 0.5 * std: return "A", "Very Good", 2
    elif score >= mean: return "B+", "Good", 3
    elif score >= mean - 0.5 * std: return "B", "Above Avg", 4
    elif score >= mean - 1.0 * std: return "C", "Average", 5
    elif score >= mean - 1.5 * std: return "D", "Below Avg", 6
    else: return "F", "Fail", 7

@app.post("/analyze")
def analyze(data: Data):
    marks = np.array(data.marks)
    stats = compute_statistics(marks)

    mean = stats["mean"]
    std = stats["std"]

    students = []
    for i in range(len(marks)):
        grade, cat, tier = assign_grade(marks[i], mean, std)
        z = 0 if std == 0 else (marks[i] - mean) / std

        students.append({
            "name": data.names[i],
            "marks": marks[i],
            "grade": grade,
            "cat": cat,
            "tier": tier,
            "z": z
        })

    return {
        "subject": data.subject,
        "stats": stats,
        "students": students
    }