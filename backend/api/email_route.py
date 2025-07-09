
# main.py or your router file
from fastapi import FastAPI, HTTPException, Body
from fastapi.routing import APIRouter
from mailjet_rest import Client as MailjetClient
from db.database import job_profiles
from config import settings
from typing import List
from bson import ObjectId

app = FastAPI()
router = APIRouter()

# Fixed: Use settings object to access credentials
mailjet_client = MailjetClient(
    auth=(settings.MAILJET_API_KEY, settings.MAILJET_SECRET_KEY),
    version="v3.1"
)

@router.post("/send-invites")
async def send_invites(
    job_id: str = Body(...),
    resume_ids: List[str] = Body(...)
):
    if not resume_ids:
        raise HTTPException(status_code=400, detail="No resume IDs provided")

    # You'll need to define job_profiles collection connection
    # Assuming you have MongoDB connection set up
    job = job_profiles.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    sent = 0
    failed = []

    for resume in job.get("scoredResumes", []):
        if str(resume["resumeId"]) in resume_ids:
            name = resume["name"]
            email = resume["email"]

            if not email:
                failed.append(f"No email for {name}")
                continue

            # Fixed: Use settings.FRONTEND_URL for dynamic URL
            interview_url = f"{settings.FRONTEND_URL}/interview/{str(job['_id'])}/{resume['resumeId']}"


            data = {
                "Messages": [
                    {
                        "From": {
                            "Email": settings.MAILJET_SENDER_EMAIL, 
                            "Name": "HR Department"
                        },
                        "To": [{"Email": email, "Name": name}],
                        "Subject": "Interview Invitation - AI-Powered Interview",
                        "TextPart": (
                            f"Dear {name},\n\n"
                            "Congratulations! You have been shortlisted for the position.\n\n"
                            f"Please click the following link to start your AI-powered interview:\n"
                            f"{interview_url}\n\n"
                            "The interview should take approximately 20-30 minutes to complete.\n"
                            "Please ensure you have a stable internet connection and are in a quiet environment.\n\n"
                            "Best regards,\n"
                            "The Hiring Team"
                        ),
                        "HTMLPart": (
                            f"<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                            f"<h2 style='color: #333;'>Dear {name},</h2>"
                            f"<p>Congratulations! You have been <strong>shortlisted</strong> for the position.</p>"
                            f"<p>Please click the button below to start your AI-powered interview:</p>"
                            f"<div style='text-align: center; margin: 30px 0;'>"
                            f"<a href='{interview_url}' style='background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;'>Start Interview</a>"
                            f"</div>"
                            f"<p><strong>Instructions:</strong></p>"
                            f"<ul>"
                            f"<li>The interview should take approximately 20-30 minutes</li>"
                            f"<li>Ensure you have a stable internet connection</li>"
                            f"<li>Please be in a quiet environment</li>"
                            f"</ul>"
                            f"<p>Best regards,<br/><strong>The Hiring Team</strong></p>"
                            f"</div>"
                        )
                    }
                ]
            }

            try:
                result = mailjet_client.send.create(data=data)
                if result.status_code == 200:
                    sent += 1
                    print(f"Email sent successfully to {name} ({email})")
                else:
                    error_msg = f"Failed for {name} ({email}) - Status: {result.status_code}"
                    if hasattr(result, 'json'):
                        error_msg += f" - Response: {result.json()}"
                    failed.append(error_msg)
                    print(error_msg)
            except Exception as e:
                error_msg = f"Error for {name} ({email}): {str(e)}"
                failed.append(error_msg)
                print(error_msg)

    return {
        "message": f"Invitation process completed",
        "invited": sent,
        "failed": len(failed),
        "errors": failed,
        "total_processed": len(resume_ids)
    }