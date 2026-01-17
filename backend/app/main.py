from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "My Personal CFO API is running!"}