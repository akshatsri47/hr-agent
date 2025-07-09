# app/api/interview.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
import asyncio
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from db.database import job_profiles, interview_scores, interview_sessions
from utils.getuser import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_MESSAGE = SystemMessage(
    content=(
        "You are an AI conducting a structured, professional interview. "
        "Follow these stages in order: introduction, experience, technical, "
        "role-specific, behavioral, closing. Ask one concise question at a time "
        "(2–3 sentences), referencing the candidate’s resume or the job description. "
        "Use a friendly but professional tone. End after {max_questions} questions."
    )
)

class InterviewSession:
    def __init__(self, job_description: str, resume_text: str, max_questions: int = 4):
        self.job_description = job_description
        self.resume_text = resume_text
        self.max_questions = max_questions
        self.conversation_history: list[dict] = []
        self.question_count = 0
        self.interview_stages = [
            "introduction", "experience", "technical",
            "role_specific", "behavioral", "closing",
        ]
        self.current_stage = 0
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.7)

    def build_prompt(self) -> list[HumanMessage | SystemMessage]:
        stage = self.interview_stages[self.current_stage]
        msgs = [
            SYSTEM_MESSAGE,
            SystemMessage(content=(
                f"Stage: {stage}\n\n"
                f"Job Description:\n{self.job_description}\n\n"
                f"Candidate’s Resume:\n{self.resume_text}"
            )),
        ]
        for turn in self.conversation_history:
            msgs.append(HumanMessage(content=f"Q: {turn['question']}"))
            msgs.append(HumanMessage(content=f"A: {turn['answer']}"))
        msgs.append(HumanMessage(
            content=f"You have asked {self.question_count} questions so far. Please ask the next one."
        ))
        return msgs

    async def get_response(self, candidate_input: str = None) -> str:
        if self.question_count == 0:
            q = (
                "Hello! I'm excited to speak with you today about this opportunity. "
                "Could you please introduce yourself and tell me why this role interests you?"
            )
        else:
            try:
                llm_out = await self.llm.ainvoke(self.build_prompt())
                q = llm_out.content
            except Exception as e:
                logger.error(f"LLM error: {e}")
                q = "That’s interesting. Can you tell me more about your relevant experience?"
        self.question_count += 1
        if self.current_stage < len(self.interview_stages) - 1:
            self.current_stage += 1
        return q

    async def score_answer(self, question: str, answer: str) -> int | None:
        prompt = (
            "On a scale from 1 to 10, how well does this answer address the question "
            "in terms of relevance and completeness? Respond with only the number.\n\n"
            f"Question: {question}\nAnswer: {answer}"
        )
        try:
            res = await self.llm.ainvoke(prompt)
            return int(res.content.strip())
        except Exception as e:
            logger.warning(f"Scoring failed: {e}")
            return None

    def add_to_history(self, question: str, answer: str, score: int | None):
        self.conversation_history.append({
            "question": question, "answer": answer, "score": score
        })

@router.websocket("/ws/interview/{job_id}/{resume_id}")
async def interview_ws(websocket: WebSocket, job_id: str, resume_id: str):
    await websocket.accept()
    try:
        job = job_profiles.find_one({"_id": ObjectId(job_id)})
        if not job:
            await websocket.send_json({"error": "Job not found"})
            return
        entry = next((r for r in job.get("scoredResumes", []) if r["resumeId"] == resume_id), None)
        if not entry:
            await websocket.send_json({"error": "Resume not found"})
            return

        session = InterviewSession(job["description"], entry["text"], max_questions=8)
        sess_doc = {"job_id": job_id, "resume_id": resume_id, "started_at": datetime.utcnow(), "history": []}
        session_id = interview_sessions.insert_one(sess_doc).inserted_id

        async def send_response(text: str):
            await websocket.send_json({
                "text": text,
                "question_count": session.question_count,
                "max_questions": session.max_questions
            })

        last_q = await session.get_response()
        await send_response(last_q)

        while True:
            try:
                msg = await websocket.receive_json()

                if msg.get("type") == "tab-switch":
                    interview_sessions.update_one(
                        {"_id": session_id},
                        {"$push": {"tabEvents": {"count": msg["count"], "timestamp": datetime.utcnow()}}}
                    )
                    continue

                if msg.get("type") == "gaze":
                    interview_sessions.update_one(
                        {"_id": session_id},
                        {"$push": {"gazeData": {
                            "x": msg["x"], "y": msg["y"], "t": msg["t"], "timestamp": datetime.utcnow()
                        }}}
                    )
                    continue

                if msg.get("type") == "object-detect":
                    interview_sessions.update_one(
                        {"_id": session_id},
                        {"$push": {"objectEvents": {
                            "people": msg["people"], "phones": msg["phones"], "timestamp": datetime.utcnow()
                        }}}
                    )
                    continue

                if msg.get("type") == "not-looking":
                    interview_sessions.update_one(
                        {"_id": session_id},
                        {"$push": {"warningEvents": {
                            "type": "not-looking", "timestamp": datetime.utcnow()
                        }}}
                    )
                    continue

                answer = msg.get("answer", "").strip()
                if not answer:
                    await websocket.send_json({"error": "Empty answer received"})
                    continue
                if answer.lower() in {"quit", "exit", "end interview"}:
                    break

                score = await session.score_answer(last_q, answer)
                interview_scores.insert_one({
                    "job_id": job_id, "resume_id": resume_id,
                    "question_number": session.question_count,
                    "question": last_q, "answer": answer,
                    "score": score, "timestamp": datetime.utcnow()
                })

                session.add_to_history(last_q, answer, score)
                interview_sessions.update_one(
                    {"_id": session_id},
                    {"$push": {"history": {
                        "question_number": session.question_count,
                        "question": last_q, "answer": answer,
                        "score": score, "timestamp": datetime.utcnow()
                    }}}
                )

                backoff = 1
                for attempt in range(3):
                    try:
                        next_q = await session.get_response(answer)
                        break
                    except Exception as e:
                        logger.error(f"Error: {e}")
                        if attempt == 2:
                            next_q = "What is your greatest strength for this role?"
                            break
                        await asyncio.sleep(backoff); backoff *= 2

                last_q = next_q
                await send_response(next_q)
                if session.question_count >= session.max_questions:
                    break

            except WebSocketDisconnect:
                return
            except Exception as e:
                logger.error(f"Loop error: {e}")
                await websocket.send_json({"error": f"Interview error: {e}"})
                return

        # Wrap-up
        doc = interview_sessions.find_one({"_id": session_id})
        scores = [h["score"] for h in doc.get("history", []) if h.get("score") is not None]
        avg = sum(scores)/len(scores) if scores else None
        if avg is not None:
            summary = (await session.llm.ainvoke(
                f"The candidate scored an average of {avg:.1f}/10. Summarize strengths & growth areas."
            )).content
        else:
            summary = "Not enough scored answers to generate a summary."

        interview_sessions.update_one(
            {"_id": session_id},
            {"$set": {"ended_at": datetime.utcnow(), "average_score": avg, "summary": summary}}
        )
        job_profiles.update_one(
            { "_id": job["_id"], "scoredResumes.resumeId": resume_id },
            { "$set": {
                "scoredResumes.$.interviewDone": True,
                "scoredResumes.$.sessionId": session_id
            }}
        )

        await send_response("Thank you for your time! Here’s a brief wrap-up:")
        await websocket.send_json({"summary": summary, "average_score": avg})

    finally:
        await websocket.close()


@router.get("/session/{session_id}")
async def get_interview_session(session_id: str):
    """Fetch the full interview session document by its ID."""
    doc = interview_sessions.find_one({"_id": ObjectId(session_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Interview session not found")
    # Convert ObjectId → str for JSON serialization
    doc["_id"] = str(doc["_id"])
    doc["job_id"]   = str(doc["job_id"])
    doc["resume_id"] = str(doc["resume_id"])
    return {"session": doc}


@router.post("/admin/reset-interview/{session_id}")
async def reset_interview(
    session_id: str,
    admin = Depends(get_current_user)
):
    """
    Deletes the in-flight session and clears the interviewDone flag
    so the candidate can be re-interviewed.
    """
    # 1. Delete the session document
    interview_sessions.delete_one({"_id": ObjectId(session_id)})

    # 2. Unset the flags in job_profiles
    job_profiles.update_one(
        { "scoredResumes.sessionId": ObjectId(session_id) },
        { "$unset": {
            "scoredResumes.$.interviewDone": "",
            "scoredResumes.$.sessionId": ""
        }}
    )

    return {"ok": True, "message": "Interview session reset"}