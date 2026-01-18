import os
from app.routes.invoices import create_invoice
import duckdb
import pandas as pd
import requests
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from app.api.dependencies import verify_token
from app.database import get_database
from bson import ObjectId
from app.models import InvoiceCreate
import time
import json
import shutil

router = APIRouter(prefix="/agent", tags=["agent"])

# This 'tricks' older libraries into finding what they ne

def run_sql_analysis(user_id: str, sql_query: str):
    """
    Executes a SQL query on the user's data using DuckDB.
    """

    db = get_database()
    user_id = db.users.find_one({"auth0_id": user_id})["_id"]
    user_id = ObjectId(user_id)
    clients = list(db.clients.find({"userId": user_id}))
    expenses = list(db.expenses.find({"userId": user_id}))
    invoices = list(db.invoices.find({"userId": user_id}))
    jobs = list(db.jobs.find({"userId": user_id}))
    profile = db.users.find_one({"_id": user_id})


    df_clients = pd.DataFrame(clients)
    df_expenses = pd.DataFrame(expenses)
    df_invoices = pd.DataFrame(invoices)
    df_jobs = pd.DataFrame(jobs)
    df_profile = pd.DataFrame([profile])

    con = duckdb.connect(database=':memory:')
    
    con.register('clients', df_clients)
    con.register('expenses', df_expenses)
    con.register('invoices', df_invoices)
    con.register('jobs', df_jobs)
    con.register('profile', df_profile)

    try:
        if "drop" in sql_query.lower() or "delete" in sql_query.lower():
            return "Safety Violation: Cannot delete data."
            
        result = con.execute(sql_query).df()
        data_as_list = result.to_dict(orient='records')
        return data_as_list
        
    except Exception as e:
        return f"SQL Error: {str(e)}"

def trigger_gumloop_agent(message: str):
    """
    Triggers the Gumloop workflow and returns the agent's decision.
    """
    url = "https://api.gumloop.com/api/v1/start_pipeline?api_key=97328eb9be81494c93ecb5cb90ce4225&user_id=MgNDAoi0fnVTD8lxMmjk1tlvSWh1&saved_item_id=kU7wBLNvGmyf7MaUXqn9Dv"
    
    headers = {
        "Authorization": f"Bearer 97328eb9be81494c93ecb5cb90ce4225",
        "Content-Type": "application/json"
    }
    
    # This payload structure depends on how you named your input nodes in Gumloop
    payload = {f"webhook_payload":"{{\"user_message\": \"{message}\"}}".format(message=message)}

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        run_id = result.get("run_id")
        status_url = f"https://api.gumloop.com/api/v1/get_pl_run?run_id={run_id}&user_id=MgNDAoi0fnVTD8lxMmjk1tlvSWh1"
        for _ in range(10):  # Try for 20 seconds
            status_res = requests.get(status_url, headers=headers).json()

            # Check if the pipeline has finished and returned outputs
            if status_res.get("state") == "DONE":

                output = status_res.get("outputs")["output"]
                return output
            
            print("Waiting for Gumloop...")
            time.sleep(2) # Wait 2 seconds before checking again

        return {"error": "Gumloop timed out"}
        
    except requests.exceptions.RequestException as e:
        print(f"Gumloop API Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reach Gumloop agent.")


class AgentRequest(BaseModel):
    message: str

@router.post("/chat")
async def chat_with_gumloop_orchestrator(req: AgentRequest, token: dict = Depends(verify_token)):
    user_id = token.get("sub")
    db = get_database()
    user_id_db = db.users.find_one({"auth0_id": user_id})["_id"]
    user_id_db = str(user_id_db)
    # 1. Send user message to Gumloop
    gumloop_response = trigger_gumloop_agent(req.message)
    clean_json_string = gumloop_response.replace('```json\n', '').replace('\n```', '').replace('```', '').strip()
    response = json.loads(clean_json_string)

    # 2. Check the "to" field
    target = response.get("to")

    if target == "system":
        # Extract the SQL query Gumloop generated
        sql_query = response.get("query")
        
        # Run it locally on your DuckDB/Mongo
        data_result = run_sql_analysis(user_id, sql_query)
        # Send the data back to Gumloop for the final "interpretation"
        final_answer = trigger_gumloop_agent(f"USE THE APP NAVIGATION ROUTE FOR THIS: {req.message} was asked which generated this query: {sql_query} which had this result: {data_result}")
        response = json.loads(final_answer)
        return {"reply": response.get("message")}
    elif target == "invoice_extractor":
        new_invoice = InvoiceCreate(invoiceTitle=response.get("invoiceTitle"), 
                                    invoiceDescription=response.get("invoiceDescription"), 
                                    status="draft",
                                    total=response.get("total"),
                                    dueDate=response.get("dueDate"),
                                    issueDate=response.get("issueDate"),
                                    lineItems=response.get("lineItems"),
                                    userId=ObjectId(user_id_db))
        await create_invoice(invoice=new_invoice)
        return {"reply": "Invoice has been created successfully."}

    # If it's for the user, just return the message directly
    print(response.get("message"))
    return {"reply": response.get("message")}


def transcribe_audio(file_path: str):
    """
    Direct API call to ElevenLabs Scribe v2.
    No SDK required = No Pydantic errors.
    """
    url = "https://api.elevenlabs.io/v1/speech-to-text"
    api_key = os.getenv("ELEVENLABS_API_KEY")
    
    if not api_key:
        print("Error: ELEVENLABS_API_KEY missing from .env")
        return None

    headers = {
        "xi-api-key": api_key
    }
    
    try:
        with open(file_path, "rb") as audio_file:
            files = {
                "file": (os.path.basename(file_path), audio_file, "audio/wav")
            }
            # Scribe v2 is their most accurate model for business/finance
            data = {
                "model_id": "scribe_v2",
                "language_code": "eng"
            }
            
            response = requests.post(url, headers=headers, files=files, data=data)
            
        if response.status_code == 200:
            # ElevenLabs returns a JSON with a 'text' field containing the transcript
            return response.json().get("text")
        else:
            print(f"ElevenLabs API Error: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"System Error during transcription: {str(e)}")
        return None
    
@router.post("/chat/voice")
async def process_voice_input(file: UploadFile = File(...)):
    # 1. Save the blob temporarily
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # 2. Get transcription
    transcript = transcribe_audio(temp_path)
    
    # 3. Cleanup file immediately
    if os.path.exists(temp_path):
        os.remove(temp_path)
    
    if not transcript:
        return {"user_text": "", "error": "Transcription failed"}
    return {"user_text": transcript}