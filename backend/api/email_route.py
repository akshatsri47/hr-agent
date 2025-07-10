import asyncio
from fastapi import FastAPI, HTTPException, Body
from fastapi.routing import APIRouter
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from typing import List
from bson import ObjectId
from db.database import job_profiles
import os

# ─── Hard-coded mail & app settings ─────────────────────────────────────────────
MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM     = os.getenv("MAIL_FROM")
MAIL_SERVER   = os.getenv("MAIL_SERVER")

# SSL-only: port 465, TLS disabled, SSL enabled
MAIL_PORT     = 465
MAIL_STARTTLS = False  # Changed from MAIL_TLS
MAIL_SSL_TLS  = True   # Changed from MAIL_SSL

FRONTEND_URL  = "https://app.yoursite.com"


conf = ConnectionConfig(
    MAIL_USERNAME=MAIL_USERNAME,
    MAIL_PASSWORD=MAIL_PASSWORD,
    MAIL_FROM=MAIL_FROM,
    MAIL_SERVER=MAIL_SERVER,
    MAIL_PORT=MAIL_PORT,
    MAIL_STARTTLS=MAIL_STARTTLS,  # Required field
    MAIL_SSL_TLS=MAIL_SSL_TLS,    # Required field
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)

fastmail = FastMail(conf)
app      = FastAPI()
router   = APIRouter()


@router.post("/send-invites")
async def send_invites(
    job_id:     str        = Body(..., embed=True),
    resume_ids: List[str] = Body(..., embed=True),
):
    job = job_profiles.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(404, "Job not found")
    if not resume_ids:
        raise HTTPException(400, "No resume IDs provided")

    sent, failed, tasks = 0, [], []

    for r in job.get("scoredResumes", []):
        rid = str(r.get("resumeId"))
        if rid not in resume_ids:
            continue

        name  = r.get("name", "Candidate")
        email = r.get("email")
        if not email:
            failed.append(f"No email for {name}")
            continue

        interview_url = f"{FRONTEND_URL}/interview/{job_id}/{rid}"

        html_body = (
            f"<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;'>"
            f"<h2>Dear {name},</h2>"
            f"<p>Congratulations—you've been <strong>shortlisted</strong>!</p>"
            f"<p><a href='{interview_url}' "
            f"style='display:inline-block;padding:12px 24px;"
            f"background:#007bff;color:#fff;text-decoration:none;"
            f"border-radius:4px;'>Start Interview</a></p>"
            f"<ul>"
            f"<li>20–30 minutes to complete</li>"
            f"<li>Stable internet connection</li>"
            f"<li>Quiet environment</li>"
            f"</ul>"
            f"<p>Best regards,<br/>The Hiring Team</p>"
            f"</div>"
        )

        message = MessageSchema(
            subject="Interview Invitation – AI-Powered Interview",
            recipients=[email],
            body=html_body,
            subtype="html",
        )
        tasks.append(fastmail.send_message(message))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for r in results:
        if isinstance(r, Exception):
            failed.append(str(r))
        else:
            sent += 1

    return {
        "message":         "Invitation process completed",
        "invited":         sent,
        "failed":          len(failed),
        "errors":          failed,
        "total_requested": len(tasks),
    }

