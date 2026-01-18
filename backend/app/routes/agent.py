import os
import duckdb
import pandas as pd
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.dependencies import verify_token
from app.database import get_database
from bson import ObjectId
import time
import json

router = APIRouter(prefix="/agent", tags=["agent"])


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

    # 1. Send user message to Gumloop
    gumloop_response = trigger_gumloop_agent(req.message)
    response = json.loads(gumloop_response)

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

    # If it's for the user, just return the message directly
    print(response.get("message"))
    return {"reply": response.get("message")}