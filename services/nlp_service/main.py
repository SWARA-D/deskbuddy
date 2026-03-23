"""NLP Service - Sentiment + Emotion Analysis using VADER"""
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, field_validator
from typing import Optional
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

app = FastAPI(title="NLP Service")
analyzer = SentimentIntensityAnalyzer()

MAX_TEXT_LENGTH = 5_000


def get_emotion(scores: dict) -> tuple[str, float]:
    """Map VADER scores to emotion labels."""
    compound = scores["compound"]
    if compound >= 0.5:
        return "excited", abs(compound)
    elif compound >= 0.1:
        return "calm", abs(compound)
    elif compound >= -0.1:
        return "neutral", 0.5
    elif compound >= -0.5:
        return "sad", abs(compound)
    else:
        return "anxious", abs(compound)


class AnalyzeRequest(BaseModel):
    text: str
    entry_id: Optional[str] = None

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Text is required")
        if len(v) > MAX_TEXT_LENGTH:
            raise ValueError(f"Text must be at most {MAX_TEXT_LENGTH} characters")
        return v

    @field_validator("entry_id")
    @classmethod
    def validate_entry_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            import uuid
            try:
                uuid.UUID(v)
            except ValueError:
                raise ValueError("entry_id must be a valid UUID")
        return v


@app.get("/health")
def health():
    return {"success": True, "data": {"status": "ok", "service": "nlp"}}


@app.post("/nlp/analyze")
def analyze(req: AnalyzeRequest, x_user_id: str = Header()):
    scores = analyzer.polarity_scores(req.text)

    if scores["compound"] >= 0.05:
        sentiment = "positive"
    elif scores["compound"] <= -0.05:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    emotion, confidence = get_emotion(scores)

    return {
        "success": True,
        "data": {
            "sentiment": sentiment,
            "emotion": emotion,
            "confidence": round(confidence, 2),
            "model_version": "vader_v1.0",
        },
        "message": "Analysis complete",
        "status_code": 200
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
